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
-- 5. CREATE SUBSCRIPTION_PLANS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly','quarterly','half_yearly','yearly')),
  price NUMERIC(10,2) NOT NULL,
  commission_percent NUMERIC(5,2) DEFAULT 0,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
-- 7. CREATE DEVICE_TOKENS TABLE
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

-- RLS for device_tokens
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
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
-- ============================================================
INSERT INTO public.subscription_plans (id, name, description, plan_type, price, commission_percent, features, is_active) VALUES
  (uuid_generate_v4(), 'Basic Monthly', 'Perfect for new shops', 'monthly', 499, 5, '{"listings": 100, "support": "email"}', true),
  (uuid_generate_v4(), 'Standard Monthly', 'Most popular for growing shops', 'monthly', 999, 3, '{"listings": 500, "support": "priority", "analytics": true}', true),
  (uuid_generate_v4(), 'Premium Monthly', 'For established businesses', 'monthly', 1999, 2, '{"listings": -1, "support": "phone", "analytics": true, "featured": true}', true)
ON CONFLICT DO NOTHING;

COMMIT;