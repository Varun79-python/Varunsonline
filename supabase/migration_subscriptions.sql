-- ============================================================
-- MIGRATION: Subscription Plans & Enhanced Agent Docs
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- SUBSCRIPTION PLANS (Admin creates these)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('percentage', 'fixed_monthly')),
  -- For percentage plans: % deducted per order
  fee_percent NUMERIC(5,2) DEFAULT 0,
  -- For fixed monthly plans: amount in INR
  monthly_fee NUMERIC(10,2) DEFAULT 0,
  duration_days INT DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SHOP SUBSCRIPTIONS (active plan per shop)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shop_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed')),
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ADD COLUMNS TO SHOPS
-- ============================================================
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS subscription_plan_id UUID REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_fee_percent NUMERIC(5,2) DEFAULT 0;

-- ============================================================
-- ADD COLUMNS TO DELIVERY AGENTS (enhanced docs)
-- ============================================================
ALTER TABLE public.delivery_agents
  ADD COLUMN IF NOT EXISTS pan_url TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_rc_url TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS pan_number TEXT;

-- ============================================================
-- ENABLE RLS ON NEW TABLES
-- ============================================================
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscription Plans policies
CREATE POLICY IF NOT EXISTS "Anyone can view active plans" ON public.subscription_plans
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY IF NOT EXISTS "Admin manages plans" ON public.subscription_plans
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Shop Subscriptions policies
CREATE POLICY IF NOT EXISTS "Shopkeeper views own subscriptions" ON public.shop_subscriptions
  FOR SELECT USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "Shopkeeper inserts own subscriptions" ON public.shop_subscriptions
  FOR INSERT WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "Admin manages subscriptions" ON public.shop_subscriptions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- ADD REALTIME FOR SUBSCRIPTIONS
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_subscriptions;

-- ============================================================
-- SEED DEFAULT PLANS
-- ============================================================
INSERT INTO public.subscription_plans (name, description, plan_type, fee_percent, monthly_fee, duration_days) VALUES
  ('Percentage Plan', 'Pay per order — 5% deducted from each order automatically', 'percentage', 5.00, 0, 0),
  ('Monthly Basic', 'Flat ₹299/month — unlimited orders', 'fixed_monthly', 0, 299.00, 30),
  ('Monthly Pro', 'Flat ₹499/month — priority listing + unlimited orders', 'fixed_monthly', 0, 499.00, 30)
ON CONFLICT DO NOTHING;
