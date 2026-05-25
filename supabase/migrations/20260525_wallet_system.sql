-- ============================================================
-- WALLET SYSTEM — Production-grade wallet & transaction ledger
-- STRICT BUSINESS RULES:
--   shopkeeperEarning = subtotal (100%)
--   agentEarning       = deliveryCharge (100%)
--   adminEarning       = platformFee (100%)
-- ============================================================

-- 1. Add wallet columns to all relevant tables (if not already present)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC(14,2) DEFAULT 0;

-- Ensure delivery_agents has total_withdrawn for tracking
ALTER TABLE public.delivery_agents
  ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC(14,2) DEFAULT 0;

-- 2. wallet_transactions already exists — add index for performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON public.wallet_transactions(created_at DESC);

-- 3. Withdrawals status constraint (ensure valid state machine)
ALTER TABLE public.withdraw_requests
  DROP CONSTRAINT IF EXISTS withdraw_requests_status_check;
ALTER TABLE public.withdraw_requests
  ADD CONSTRAINT withdraw_requests_status_check
  CHECK (status IN ('pending','approved','rejected','processing','paid'));

-- 4. Trigger: auto-credit wallet on order delivery
--   Shopkeeper gets: subtotal (items total) → credited to shops.wallet_balance
--   Delivery agent gets: delivery_charge → credited to delivery_agents.wallet_balance
CREATE OR REPLACE FUNCTION credit_order_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  shop_owner_id UUID;
  agent_id_val UUID;
  subtotal_val NUMERIC;
  delivery_charge_val NUMERIC;
BEGIN
  -- Only run when order status changes TO 'delivered' (not on re-updates)
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    subtotal_val := COALESCE(NEW.subtotal, 0);
    delivery_charge_val := COALESCE(NEW.delivery_charge, 0);

    -- Credit shopkeeper
    SELECT owner_id INTO shop_owner_id FROM public.shops WHERE id = NEW.shop_id;
    IF shop_owner_id IS NOT NULL AND subtotal_val > 0 THEN
      UPDATE public.shops
        SET wallet_balance = COALESCE(wallet_balance, 0) + subtotal_val,
            total_earnings = COALESCE(total_earnings, 0) + subtotal_val,
            total_orders = COALESCE(total_orders, 0) + 1
        WHERE owner_id = shop_owner_id;
    END IF;

    -- Credit delivery agent (if assigned)
    agent_id_val := COALESCE(NEW.agent_id, NEW.delivery_agent_id);  -- support both column names
    IF agent_id_val IS NOT NULL AND delivery_charge_val > 0 THEN
      UPDATE public.delivery_agents
        SET wallet_balance = COALESCE(wallet_balance, 0) + delivery_charge_val,
            total_earnings = COALESCE(total_earnings, 0) + delivery_charge_val,
            today_earnings = COALESCE(today_earnings, 0) + delivery_charge_val,
            total_deliveries = COALESCE(total_deliveries, 0) + 1
        WHERE id = agent_id_val;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_order_earnings_trigger ON public.orders;
CREATE TRIGGER credit_order_earnings_trigger
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'delivered')
  EXECUTE FUNCTION credit_order_earnings();

-- 5. Function: process withdrawal (admin action)
-- Funds are locked (deducted) when the request was submitted.
-- On reject: funds are refunded to wallet.
-- On mark_paid: total_withdrawn counter is updated (funds already deducted).
CREATE OR REPLACE FUNCTION process_withdrawal(
  p_withdrawal_id UUID,
  p_action TEXT,  -- 'approve', 'reject', 'mark_paid'
  p_admin_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request record;
  v_new_status TEXT;
BEGIN
  SELECT * INTO v_request FROM public.withdraw_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Withdrawal request is already %', v_request.status;
  END IF;

  IF p_action = 'approve' THEN
    v_new_status := 'approved';
  ELSIF p_action = 'reject' THEN
    v_new_status := 'rejected';
    -- Refund locked funds back to wallet
    IF v_request.user_type = 'shopkeeper' THEN
      UPDATE public.shops SET wallet_balance = COALESCE(wallet_balance, 0) + v_request.amount
      WHERE owner_id = v_request.user_id;
    ELSE
      UPDATE public.delivery_agents SET wallet_balance = COALESCE(wallet_balance, 0) + v_request.amount
      WHERE id = v_request.user_id;
    END IF;
  ELSIF p_action = 'mark_paid' THEN
    v_new_status := 'paid';
    -- Update total_withdrawn counters (funds already deducted on request submission)
    IF v_request.user_type = 'shopkeeper' THEN
      UPDATE public.shops SET total_withdrawn = COALESCE(total_withdrawn, 0) + v_request.amount
      WHERE owner_id = v_request.user_id;
    ELSE
      UPDATE public.delivery_agents SET total_withdrawn = COALESCE(total_withdrawn, 0) + v_request.amount
      WHERE id = v_request.user_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  UPDATE public.withdraw_requests
    SET status = v_new_status, processed_at = NOW(), processed_by = p_admin_id
    WHERE id = p_withdrawal_id;

  RETURN TRUE;
END;
$$;
