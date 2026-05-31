-- ============================================================
-- VARUN'S ONLINE — Login Tracking & Account Lockout
-- 
-- Creates login_attempts audit table + lockout columns on profiles
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. LOGIN ATTEMPTS AUDIT TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT,
  phone TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  role TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lockout queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created
  ON public.login_attempts(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id
  ON public.login_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at
  ON public.login_attempts(created_at);

-- RLS: login_attempts is insert-only from API routes with service_role
-- Regular users should never query this table directly
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only allow inserts for authenticated users (service_role bypasses this)
CREATE POLICY "login_attempts_insert_policy" ON public.login_attempts
  FOR INSERT WITH CHECK (true);

-- Block all other operations for regular users
CREATE POLICY "login_attempts_select_policy" ON public.login_attempts
  FOR SELECT USING (false);

CREATE POLICY "login_attempts_update_policy" ON public.login_attempts
  FOR UPDATE USING (false);

CREATE POLICY "login_attempts_delete_policy" ON public.login_attempts
  FOR DELETE USING (false);

-- ============================================================
-- 2. ADD LOCKOUT COLUMNS TO PROFILES
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT NULL;

-- Index for lockout queries by email
CREATE INDEX IF NOT EXISTS idx_profiles_email_lockout
  ON public.profiles(email, locked_until)
  WHERE locked_until IS NOT NULL;

-- ============================================================
-- 3. HELPER FUNCTION: CHECK IF ACCOUNT IS LOCKED
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_account_locked(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_locked_until TIMESTAMPTZ;
BEGIN
  SELECT locked_until INTO v_locked_until
  FROM public.profiles
  WHERE email = p_email
  LIMIT 1;

  IF v_locked_until IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_locked_until > NOW() THEN
    RETURN TRUE;
  END IF;

  -- Lockout expired — clear it
  UPDATE public.profiles
  SET locked_until = NULL
  WHERE email = p_email;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
