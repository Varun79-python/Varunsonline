-- ============================================================
-- VARUN'S ONLINE — COD SETTLEMENT + SUBSCRIPTION ENHANCEMENTS
-- ============================================================
-- Part A: COD Settlement System
-- Part B: Subscription System Enhancements
-- ============================================================

-- ============================================================
-- PART A: COD SETTLEMENT SYSTEM
-- ============================================================

-- A1. Agent COD Settlement Ledger
CREATE TABLE IF NOT EXISTS public.agent_cod_settlement_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  cash_collected NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_owed_to_platform NUMERIC(12,2) NOT NULL DEFAULT 0,
  settled_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partially_paid','settled','overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_cod_settlement_agent ON public.agent_cod_settlement_ledger(agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cod_settlement_order ON public.agent_cod_settlement_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_cod_settlement_status ON public.agent_cod_settlement_ledger(status);

-- A2. Add COD settlement columns to delivery_agents
ALTER TABLE public.delivery_agents
  ADD COLUMN IF NOT EXISTS pending_cod_due NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_withdrawal_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_withdrawal_reset TIMESTAMPTZ DEFAULT NOW();

-- A3. Add withdrawal limit columns to shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS weekly_withdrawal_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_withdrawal_reset TIMESTAMPTZ DEFAULT NOW();

-- A4. Enhanced payment statuses on orders (new statuses via check constraint)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN (
    'pending', 'paid', 'failed', 'refunded',
    'cod_pending', 'cod_cash_collected', 'cod_qr_pending', 'cod_qr_verified',
    'settlement_due', 'settlement_partial', 'settlement_completed'
  ));

-- A5. Enhanced order status check constraint (add COD_COLLECTED)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'payment_pending', 'payment_confirmed', 'payment_failed',
    'shop_accepted', 'shop_rejected',
    'agent_assigned', 'agent_rejected',
    'picked_up', 'out_for_delivery',
    'cod_pending', 'cod_cash_collected',
    'delivered',
    'cancelled', 'rejected'
  ));

-- ============================================================
-- PART B: SUBSCRIPTION SYSTEM ENHANCEMENTS
-- ============================================================

-- B1. Subscription payments tracking table
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  subscription_id UUID REFERENCES public.shop_subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT UNIQUE,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  payment_method TEXT DEFAULT 'razorpay' CHECK (payment_method IN ('razorpay','free','admin_grant','cash','bank_transfer')),
  is_free_plan BOOLEAN DEFAULT FALSE,
  granted_by UUID REFERENCES public.profiles(id),  -- admin who granted free plan
  grant_reason TEXT,  -- 'promotion','manual_approval','special_case','testing','partnership'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sub_payments_shop ON public.subscription_payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_plan ON public.subscription_payments(plan_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_status ON public.subscription_payments(payment_status);

-- B2. Add enhanced columns to subscription_plans (if not exist)
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT '',  -- e.g. 'popular', 'best_value', 'pro'
  ADD COLUMN IF NOT EXISTS priority INT DEFAULT 0,  -- display order
  ADD COLUMN IF NOT EXISTS benefits JSONB DEFAULT '[]';  -- list of benefit strings

-- B3. Add enhanced columns to shop_subscriptions (if not exist)
ALTER TABLE public.shop_subscriptions
  ADD COLUMN IF NOT EXISTS is_free_plan BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS grant_reason TEXT,
  ADD COLUMN IF NOT EXISTS subscription_payment_id UUID REFERENCES public.subscription_payments(id),
  ADD COLUMN IF NOT EXISTS notified_7d BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notified_3d BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notified_1d BOOLEAN DEFAULT FALSE;

-- ============================================================
-- PART C: FUNCTION — Auto-recover COD dues from agent earnings
-- ============================================================
CREATE OR REPLACE FUNCTION auto_recover_cod_due(
  p_agent_id UUID,
  p_earning_amount NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_pending NUMERIC;
  v_recovered NUMERIC;
  v_net_earning NUMERIC;
  v_remaining NUMERIC;
BEGIN
  -- Get total pending COD dues for this agent
  SELECT COALESCE(SUM(pending_amount), 0) INTO v_total_pending
  FROM public.agent_cod_settlement_ledger
  WHERE agent_id = p_agent_id
    AND status IN ('pending', 'partially_paid');

  IF v_total_pending <= 0 THEN
    RETURN p_earning_amount;  -- No dues, return full earning
  END IF;

  -- Recover from earning
  v_recovered := LEAST(p_earning_amount, v_total_pending);
  v_net_earning := p_earning_amount - v_recovered;
  v_remaining := v_total_pending - v_recovered;

  -- Update pending amounts on oldest unsettled entries first
  IF v_recovered > 0 THEN
    -- Use a subquery with a stable order to pick which entries to update
    UPDATE public.agent_cod_settlement_ledger
    SET 
      settled_amount = LEAST(
        COALESCE(settled_amount, 0) + v_recovered,
        amount_owed_to_platform
      ),
      pending_amount = amount_owed_to_platform - LEAST(
        COALESCE(settled_amount, 0) + v_recovered,
        amount_owed_to_platform
      ),
      status = CASE 
        WHEN amount_owed_to_platform - LEAST(
          COALESCE(settled_amount, 0) + v_recovered,
          amount_owed_to_platform
        ) <= 0 THEN 'settled'
        ELSE 'partially_paid'
      END,
      settled_at = CASE 
        WHEN amount_owed_to_platform - LEAST(
          COALESCE(settled_amount, 0) + v_recovered,
          amount_owed_to_platform
        ) <= 0 THEN NOW()
        ELSE NULL
      END,
      notes = CASE 
        WHEN amount_owed_to_platform - LEAST(
          COALESCE(settled_amount, 0) + v_recovered,
          amount_owed_to_platform
        ) <= 0 THEN 'Auto-recovered from delivery earnings'
        ELSE 'Partial auto-recovery from delivery earnings'
      END
    WHERE id = (
      SELECT id FROM public.agent_cod_settlement_ledger
      WHERE agent_id = p_agent_id
        AND status IN ('pending', 'partially_paid')
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;

  -- Update agent's pending_cod_due
  UPDATE public.delivery_agents
  SET pending_cod_due = v_remaining
  WHERE id = p_agent_id;

  RETURN v_net_earning;
END;
$$;

-- ============================================================
-- PART D: FUNCTION — Reset weekly withdrawal counters (run Monday 12 AM)
-- ============================================================
CREATE OR REPLACE FUNCTION reset_weekly_withdrawal_limits()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agents_updated INT;
  v_shops_updated INT;
BEGIN
  UPDATE public.delivery_agents
  SET weekly_withdrawal_count = 0,
      last_withdrawal_reset = NOW()
  WHERE last_withdrawal_reset < date_trunc('week', NOW());

  GET DIAGNOSTICS v_agents_updated = ROW_COUNT;

  UPDATE public.shops
  SET weekly_withdrawal_count = 0,
      last_withdrawal_reset = NOW()
  WHERE last_withdrawal_reset < date_trunc('week', NOW());

  GET DIAGNOSTICS v_shops_updated = ROW_COUNT;

  RETURN v_agents_updated + v_shops_updated;
END;
$$;

-- ============================================================
-- PART E: FUNCTION — Manually settle COD dues (admin action)
-- ============================================================
CREATE OR REPLACE FUNCTION manual_cod_settlement(
  p_ledger_id UUID,
  p_settle_amount NUMERIC,
  p_admin_id UUID,
  p_notes TEXT DEFAULT ''
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ledger RECORD;
  v_new_pending NUMERIC;
  v_new_settled NUMERIC;
BEGIN
  SELECT * INTO v_ledger FROM public.agent_cod_settlement_ledger WHERE id = p_ledger_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ledger entry not found'; END IF;

  IF p_settle_amount <= 0 THEN RAISE EXCEPTION 'Settlement amount must be positive'; END IF;

  v_new_settled := COALESCE(v_ledger.settled_amount, 0) + p_settle_amount;
  v_new_pending := GREATEST(0, v_ledger.amount_owed_to_platform - v_new_settled);

  UPDATE public.agent_cod_settlement_ledger
  SET settled_amount = v_new_settled,
      pending_amount = v_new_pending,
      status = CASE WHEN v_new_pending <= 0 THEN 'settled' ELSE 'partially_paid' END,
      settled_at = CASE WHEN v_new_pending <= 0 THEN NOW() ELSE NULL END,
      notes = CASE WHEN p_notes != '' THEN p_notes ELSE notes END
  WHERE id = p_ledger_id;

  -- Update agent pending_cod_due
  UPDATE public.delivery_agents
  SET pending_cod_due = COALESCE((
    SELECT SUM(pending_amount) FROM public.agent_cod_settlement_ledger
    WHERE agent_id = v_ledger.agent_id AND status IN ('pending', 'partially_paid')
  ), 0)
  WHERE id = v_ledger.agent_id;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- PART F: FUNCTION — Get withdrawable balance (strict formula)
-- ============================================================
CREATE OR REPLACE FUNCTION get_withdrawable_balance(
  p_user_id UUID,
  p_user_type TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_balance NUMERIC;
  v_pending_cod_due NUMERIC;
  v_withdrawable NUMERIC;
BEGIN
  IF p_user_type = 'shopkeeper' THEN
    SELECT wallet_balance, 0
    INTO v_wallet_balance, v_pending_cod_due
    FROM public.shops WHERE owner_id = p_user_id;
  ELSIF p_user_type = 'delivery_agent' THEN
    SELECT wallet_balance, COALESCE(pending_cod_due, 0)
    INTO v_wallet_balance, v_pending_cod_due
    FROM public.delivery_agents WHERE id = p_user_id;
  ELSE
    RETURN 0;
  END IF;

  v_wallet_balance := COALESCE(v_wallet_balance, 0);
  v_withdrawable := GREATEST(0, v_wallet_balance - v_pending_cod_due);
  RETURN v_withdrawable;
END;
$$;

-- ============================================================
-- PART G: FUNCTION — Count weekly withdrawals for a user
-- ============================================================
CREATE OR REPLACE FUNCTION get_weekly_withdrawal_count(
  p_user_id UUID,
  p_user_type TEXT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_reset_time TIMESTAMPTZ;
  v_week_start TIMESTAMPTZ;
BEGIN
  v_week_start := date_trunc('week', NOW());

  -- Count withdrawals created since the start of this week
  SELECT COUNT(*) INTO v_count
  FROM public.withdraw_requests
  WHERE user_id = p_user_id
    AND user_type = p_user_type
    AND created_at >= v_week_start;

  RETURN v_count;
END;
$$;

-- ============================================================
-- PART H: SCHEMA FIXES — Missing columns discovered during audit
-- ============================================================

-- H1. Add created_at alias to withdraw_requests (schema uses requested_at but code queries created_at)
ALTER TABLE public.withdraw_requests
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Copy existing requested_at values into created_at (run once)
UPDATE public.withdraw_requests SET created_at = requested_at WHERE created_at IS NULL;

-- Make created_at default to NOW() going forward
ALTER TABLE public.withdraw_requests
  ALTER COLUMN created_at SET DEFAULT NOW();

-- H2. Add wallet tracking columns to withdraw_requests (for audit trail)
ALTER TABLE public.withdraw_requests
  ADD COLUMN IF NOT EXISTS wallet_balance_before NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_balance_after NUMERIC(12,2) DEFAULT 0;

-- H3. Add is_blocked flag to delivery_agents (for fraud prevention)
ALTER TABLE public.delivery_agents
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- H4. Fix get_weekly_withdrawal_count to handle both created_at and requested_at
CREATE OR REPLACE FUNCTION get_weekly_withdrawal_count(
  p_user_id UUID,
  p_user_type TEXT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_week_start TIMESTAMPTZ;
BEGIN
  v_week_start := date_trunc('week', NOW());

  -- Use created_at if available, fallback to requested_at
  SELECT COUNT(*) INTO v_count
  FROM public.withdraw_requests
  WHERE user_id = p_user_id
    AND user_type = p_user_type
    AND (
      (created_at IS NOT NULL AND created_at >= v_week_start)
      OR
      (created_at IS NULL AND requested_at >= v_week_start)
    );

  RETURN v_count;
END;
$$;
