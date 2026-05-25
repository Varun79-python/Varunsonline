-- ============================================================
-- Migration: Fix Missing Schema Elements
-- Run this in Supabase SQL Editor AFTER schema.sql
-- Fixes: missing columns, missing tables, missing functions
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ADD MISSING COLUMNS TO ORDERS TABLE
-- ============================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_otp TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS otp_attempts INT DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('online','cod'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cod_collected_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cod_payment_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_latitude DOUBLE PRECISION;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_longitude DOUBLE PRECISION;

-- ============================================================
-- 2. ADD MISSING PHONE COLUMN TO DELIVERY_AGENTS
-- ============================================================
ALTER TABLE public.delivery_agents ADD COLUMN IF NOT EXISTS phone TEXT;

-- ============================================================
-- 3. ADD MISSING COLUMNS TO WALLET_TRANSACTIONS
-- ============================================================
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS balance_after NUMERIC(12,2);
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS settlement_type TEXT CHECK (settlement_type IN ('settlement','withdrawal','earning','refund'));

-- ============================================================
-- 4. ADD MISSING COLUMNS TO SHOPS TABLE
-- ============================================================
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;

-- ============================================================
-- 5. SUBSCRIPTION_PLANS TABLE — reconciled schema
--    Supports both percentage and fixed-monthly plan types
--    (used by webhooks, admin panel, and shopkeeper UI)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('percentage','fixed_monthly','monthly','quarterly','half_yearly','yearly')),
  -- percentage-plan columns (used by shopkeeper UI and webhook)
  fee_percent NUMERIC(5,2) DEFAULT 0,
  monthly_fee NUMERIC(10,2) DEFAULT 0,
  duration_days INT DEFAULT 30,
  -- fixed-price-plan columns (from earlier schema attempt)
  price NUMERIC(10,2),
  commission_percent NUMERIC(5,2) DEFAULT 0,
  features JSONB DEFAULT '{}',
  -- common
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add any missing columns in case table already existed with different schema
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS fee_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS duration_days INT DEFAULT 30;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';

-- Relax check constraint to accept all plan types (drop old, create new)
ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_plan_type_check;
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_plan_type_check
  CHECK (plan_type IN ('percentage','fixed_monthly','monthly','quarterly','half_yearly','yearly'));

-- Make price nullable (percentage plans have no fixed price)
ALTER TABLE public.subscription_plans ALTER COLUMN price DROP NOT NULL;

-- RLS for subscription_plans
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admin manages plans" ON public.subscription_plans FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- 6. CREATE SHOP_SUBSCRIPTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shop_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  auto_renew BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for shop_subscriptions
ALTER TABLE public.shop_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop owner views own subscription" ON public.shop_subscriptions FOR SELECT USING (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);
CREATE POLICY "Shop owner manages own subscription" ON public.shop_subscriptions FOR INSERT WITH CHECK (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);
CREATE POLICY "Admin manages all subscriptions" ON public.shop_subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- 7. DEVICE_TOKENS TABLE — reconciled schema
-- ============================================================
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios','web')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Reconcile: if table was created by earlier migration with different schema,
-- add any missing columns and fix FK to reference profiles(id)
ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'android';
ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Recreate FK to profiles(id) if it currently references auth.users(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'device_tokens'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'users'
      AND ccu.table_schema = 'auth'
  ) THEN
    ALTER TABLE public.device_tokens DROP CONSTRAINT device_tokens_user_id_fkey;
    ALTER TABLE public.device_tokens ADD FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- RLS for device_tokens
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User manages own tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users manage own device_tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Admin manages all device_tokens" ON public.device_tokens;
CREATE POLICY "User manages own tokens" ON public.device_tokens FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- 8. ADD MISSING RLS POLICIES
-- ============================================================

-- customers table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer views own profile" ON public.customers FOR SELECT USING (id = auth.uid());
CREATE POLICY "Customer updates own profile" ON public.customers FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Customer inserts own profile" ON public.customers FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Admin manages customers" ON public.customers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- order_items table - add missing RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer views own order items" ON public.order_items FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
);
CREATE POLICY "Shop views own order items" ON public.order_items FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
);
CREATE POLICY "Agent views assigned order items" ON public.order_items FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE agent_id = auth.uid())
);
CREATE POLICY "Admin views all order items" ON public.order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- order_status_history table - add RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer views own order history" ON public.order_status_history FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
);
CREATE POLICY "Shop views own order history" ON public.order_status_history FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
);
CREATE POLICY "Agent views assigned order history" ON public.order_status_history FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE agent_id = auth.uid())
);
CREATE POLICY "Admin views all order history" ON public.order_status_history FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Profile inserts order history" ON public.order_status_history FOR INSERT WITH CHECK (TRUE);

-- reviews table - add RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (TRUE);
CREATE POLICY "Customer creates review" ON public.reviews FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Shop owner views own reviews" ON public.reviews FOR SELECT USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));
CREATE POLICY "Admin manages reviews" ON public.reviews FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- shop_documents table - add RLS
ALTER TABLE public.shop_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop owner views own documents" ON public.shop_documents FOR SELECT USING (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);
CREATE POLICY "Shop owner uploads own documents" ON public.shop_documents FOR INSERT WITH CHECK (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);
CREATE POLICY "Admin manages all shop documents" ON public.shop_documents FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- 9. CREATE INCREMENT_COUPON_USAGE FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_code_param TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.coupons
  SET used_count = used_count + 1
  WHERE code = coupon_code_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. CREATE DECREMENT_PRODUCT_STOCK FUNCTION (prevents overselling)
-- ============================================================
CREATE OR REPLACE FUNCTION public.decrement_product_stock(product_id_param UUID, quantity_param INT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = GREATEST(0, stock_quantity - quantity_param),
      is_available = CASE WHEN stock_quantity - quantity_param <= 0 THEN FALSE ELSE is_available END,
      updated_at = NOW()
  WHERE id = product_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. ADD INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_agent_id ON public.orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON public.orders(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_shop_id ON public.products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON public.products(is_available);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_shop_id ON public.shop_subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_end_date ON public.shop_subscriptions(end_date);

-- ============================================================
-- 11. SEED DEFAULT SUBSCRIPTION PLANS
--     Plan types used by code: 'percentage' (per-order commission)
--     and 'fixed_monthly' (fixed monthly fee)
-- ============================================================
INSERT INTO public.subscription_plans (id, name, description, plan_type, fee_percent, monthly_fee, duration_days, price, commission_percent, features, is_active) VALUES
  (uuid_generate_v4(), 'Basic Percentage', 'Pay-as-you-go — small commission per order', 'percentage', 5, 0, 30, NULL, 5, '{"listings": 100, "support": "email"}', true),
  (uuid_generate_v4(), 'Standard Monthly', 'Most popular — fixed monthly fee', 'fixed_monthly', 3, 999, 30, 999, 3, '{"listings": 500, "support": "priority", "analytics": true}', true),
  (uuid_generate_v4(), 'Premium Monthly', 'For established businesses — lowest commission', 'fixed_monthly', 2, 1999, 30, 1999, 2, '{"listings": -1, "support": "phone", "analytics": true, "featured": true}', true)
ON CONFLICT DO NOTHING;

COMMIT;