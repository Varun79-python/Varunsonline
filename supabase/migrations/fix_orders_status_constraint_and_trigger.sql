-- ============================================================
-- Migration: Fix Orders Status Constraint & Trigger
-- Fixes two bugs found during production testing:
--   1. orders_status_check missing 'placed' and 'order_packed'
--   2. credit_order_earnings() trigger references non-existent
--      delivery_agent_id column
-- ============================================================

BEGIN;

-- ============================================================
-- FIX 1: Add missing statuses to orders_status_check
-- Migration 20260525_cod_settlement_subscription.sql dropped
-- the original constraint and created a new one that omitted
-- 'placed' and 'order_packed'.
-- ============================================================
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'placed',                     -- <-- was missing (used by COD orders)
    'payment_pending', 'payment_confirmed', 'payment_failed',
    'shop_accepted', 'shop_rejected',
    'order_packed',               -- <-- was missing (used by Pack action)
    'agent_assigned', 'agent_rejected',
    'picked_up', 'out_for_delivery',
    'cod_pending', 'cod_cash_collected',
    'delivered',
    'cancelled', 'rejected'
  ));

-- ============================================================
-- FIX 2: Fix credit_order_earnings() trigger function
-- The function references NEW.delivery_agent_id which does NOT
-- exist on the orders table. The correct column is agent_id.
-- This bug prevents ANY status update to 'delivered'.
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_order_earnings()
RETURNS TRIGGER AS $$
DECLARE
  shop_owner_id UUID;
  subtotal_val NUMERIC;
  delivery_charge_val NUMERIC;
  platform_fee_val NUMERIC;
  admin_earning_val NUMERIC;
  agent_id_val UUID;
BEGIN
  SELECT owner_id INTO shop_owner_id FROM public.shops WHERE id = NEW.shop_id;
  subtotal_val := COALESCE(NEW.subtotal, 0);
  delivery_charge_val := COALESCE(NEW.delivery_charge, 0);
  platform_fee_val := COALESCE(NEW.platform_fee, 0);
  admin_earning_val := COALESCE(NEW.admin_earning, 0);

  -- Credit shop owner (subtotal goes to shop)
  IF shop_owner_id IS NOT NULL AND subtotal_val > 0 THEN
    UPDATE public.shops
      SET wallet_balance = COALESCE(wallet_balance, 0) + subtotal_val,
          total_earnings = COALESCE(total_earnings, 0) + subtotal_val,
          total_orders = COALESCE(total_orders, 0) + 1
      WHERE owner_id = shop_owner_id;
  END IF;

  -- Credit delivery agent (delivery charge goes to agent)
  -- FIXED: Was COALESCE(NEW.agent_id, NEW.delivery_agent_id)
  --        but delivery_agent_id column does NOT exist on orders table
  agent_id_val := NEW.agent_id;
  IF agent_id_val IS NOT NULL AND delivery_charge_val > 0 THEN
    UPDATE public.delivery_agents
      SET wallet_balance = COALESCE(wallet_balance, 0) + delivery_charge_val,
          total_earnings = COALESCE(total_earnings, 0) + delivery_charge_val,
          today_earnings = COALESCE(today_earnings, 0) + delivery_charge_val,
          total_deliveries = COALESCE(total_deliveries, 0) + 1
      WHERE id = agent_id_val;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX 3: Fix secure-place and place-cod routes to use valid status
-- The frontend sends payment_method='cod', but the code uses
-- status='placed' which the new constraint rejects. However,
-- since we've now added 'placed' back to the constraint, COD
-- orders will work again without code changes.
-- ============================================================

COMMIT;
