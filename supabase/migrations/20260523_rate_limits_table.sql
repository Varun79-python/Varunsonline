-- ============================================================
-- Rate Limits Table
-- Replaces in-memory Map() rate limiter — shared across all
-- Vercel Lambda instances via Supabase DB.
-- Run in: Supabase Dashboard → SQL Editor
-- Safe: idempotent (IF NOT EXISTS / OR REPLACE)
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  identifier TEXT NOT NULL,
  endpoint   TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identifier, endpoint)
);

-- Index for cleanup query (prune expired windows)
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start
  ON rate_limits (window_start);

-- Disable RLS — this table is only accessed via service role from API routes
ALTER TABLE rate_limits DISABLE ROW LEVEL SECURITY;

-- ── Atomic increment function ─────────────────────────────────────────────────
-- Returns the NEW count after increment.
-- If the window has expired (window_start + window_ms < now), resets to 1.
-- Uses INSERT ... ON CONFLICT DO UPDATE for atomic read-modify-write.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_identifier TEXT,
  p_endpoint   TEXT,
  p_window_ms  INTEGER  -- window size in milliseconds
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count      INTEGER;
  v_window_start TIMESTAMPTZ;
  v_now        TIMESTAMPTZ := NOW();
  v_window_duration INTERVAL := (p_window_ms || ' milliseconds')::INTERVAL;
BEGIN
  -- Try to insert a new row; on conflict, atomically increment or reset
  INSERT INTO rate_limits (identifier, endpoint, count, window_start)
  VALUES (p_identifier, p_endpoint, 1, v_now)
  ON CONFLICT (identifier, endpoint) DO UPDATE
    SET
      count = CASE
        -- Window expired — start fresh
        WHEN rate_limits.window_start + v_window_duration < v_now THEN 1
        -- Same window — increment
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start + v_window_duration < v_now THEN v_now
        ELSE rate_limits.window_start
      END
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;

-- ── Cleanup function (optional — call from cron to prune old rows) ────────────
CREATE OR REPLACE FUNCTION cleanup_rate_limits(p_older_than_hours INTEGER DEFAULT 2)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < NOW() - (p_older_than_hours || ' hours')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ============================================================
-- VERIFICATION — run separately after migration:
-- SELECT * FROM rate_limits LIMIT 5;
-- SELECT increment_rate_limit('test-ip', 'test-endpoint', 60000);
-- SELECT increment_rate_limit('test-ip', 'test-endpoint', 60000);
-- Expected: first call returns 1, second returns 2
-- ============================================================
