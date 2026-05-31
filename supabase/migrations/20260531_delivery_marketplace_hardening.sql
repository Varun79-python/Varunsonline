-- ============================================================
-- DELIVERY MARKETPLACE PRODUCTION HARDENING
-- Adds: GPS freshness tracking, missing indexes, agent suspension
-- 
-- Prerequisites: schema.sql + all prior migrations
-- Safe: all use IF NOT EXISTS — idempotent
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- 1. GPS FRESHNESS TRACKING
--    Tracks when GPS was last updated so we can reject stale
--    locations (> 15 min old) at order acceptance time.
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.delivery_agents
  ADD COLUMN IF NOT EXISTS gps_updated_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════
-- 2. AGENT SUSPENSION SYSTEM
--    Separate from is_blocked (fraud lock) — for operational
--    suspension by admin (e.g., repeated violations).
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.delivery_agents
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;

ALTER TABLE public.delivery_agents
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- ═══════════════════════════════════════════════════════════
-- 3. MISSING INDEXES
--    Identified during production hardening audit
-- ═══════════════════════════════════════════════════════════

-- 3a. Orders: status + created_at DESC WHERE agent_id IS NULL
--     Covers the delivery/orders GET query:
--     .in('status', ['shop_accepted','order_packed']).is('agent_id', null).order('created_at', DESC)
CREATE INDEX IF NOT EXISTS idx_orders_status_unassigned_created_at
  ON public.orders (status, created_at DESC)
  WHERE agent_id IS NULL;

-- 3b. Delivery agents: is_available standalone (quick online/offline filter)
CREATE INDEX IF NOT EXISTS idx_delivery_agents_is_available
  ON public.delivery_agents (is_available);

-- 3c. Delivery agents: is_suspended (admin queries + assignment guard)
CREATE INDEX IF NOT EXISTS idx_delivery_agents_is_suspended
  ON public.delivery_agents (is_suspended)
  WHERE is_suspended = TRUE;

-- 3d. Order status history: changed_by + status (agent's historical queries)
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_by
  ON public.order_status_history (changed_by, status, created_at DESC);

-- 3e. Orders: payment_method (for COD-specific query performance)
CREATE INDEX IF NOT EXISTS idx_orders_payment_method
  ON public.orders (payment_method)
  WHERE payment_method IS NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION QUERY (run separately after migration)
-- ═══════════════════════════════════════════════════════════
-- SELECT indexname, tablename, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND (tablename IN ('orders','delivery_agents','order_status_history'))
-- ORDER BY tablename, indexname;

COMMIT;
