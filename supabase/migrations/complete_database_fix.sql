-- ============================================================
-- COMPLETE DATABASE FIX - Run this in Supabase SQL Editor
-- Fixes all identified issues
-- ============================================================

BEGIN;

-- ============================================================
-- 1. FIX SHOP_DOCUMENTS TABLE
-- ============================================================

-- Add missing columns
ALTER TABLE public.shop_documents 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS shop_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS aadhar_url TEXT;

-- Make shop_id nullable (allows documents without shop)
ALTER TABLE public.shop_documents ALTER COLUMN shop_id DROP NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shop_documents_user_id ON public.shop_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_documents_status ON public.shop_documents(status);

-- ============================================================
-- 2. CREATE is_admin() FUNCTION FOR RLS
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. FIX RLS POLICIES
-- ============================================================

-- shop_documents
ALTER TABLE public.shop_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages all shop documents" ON public.shop_documents;
CREATE POLICY "Admin manages all shop documents" ON public.shop_documents FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own shop documents" ON public.shop_documents;
CREATE POLICY "Users can view own shop documents" ON public.shop_documents FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own shop documents" ON public.shop_documents;
CREATE POLICY "Users can insert own shop documents" ON public.shop_documents FOR INSERT WITH CHECK (user_id = auth.uid());

-- profiles
DROP POLICY IF EXISTS "Admin sees all profiles" ON public.profiles;
CREATE POLICY "Admin sees all profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- shops
DROP POLICY IF EXISTS "Admin manages all shops" ON public.shops;
CREATE POLICY "Admin manages all shops" ON public.shops FOR ALL USING (public.is_admin());

-- customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manages customers" ON public.customers;
CREATE POLICY "Admin manages customers" ON public.customers FOR ALL USING (public.is_admin());

-- delivery_agents
DROP POLICY IF EXISTS "Admin manages all agents" ON public.delivery_agents;
CREATE POLICY "Admin manages all agents" ON public.delivery_agents FOR ALL USING (public.is_admin());

-- orders
DROP POLICY IF EXISTS "Admin manages all orders" ON public.orders;
CREATE POLICY "Admin manages all orders" ON public.orders FOR ALL USING (public.is_admin());

-- ============================================================
-- 4. FIX COMPLAINTS TABLE (Create alias to customer_complaints)
-- ============================================================

-- Create complaints view that points to customer_complaints
CREATE OR REPLACE VIEW public.complaints AS
SELECT * FROM public.customer_complaints;

-- Add RLS to customer_complaints if not enabled
ALTER TABLE public.customer_complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages all complaints" ON public.customer_complaints;
CREATE POLICY "Admin manages all complaints" ON public.customer_complaints FOR ALL USING (public.is_admin());

-- ============================================================
-- 5. SEED SUBSCRIPTION PLANS
-- ============================================================

-- Note: Using columns from migration_subscriptions.sql which is already applied
INSERT INTO public.subscription_plans (id, name, description, plan_type, fee_percent, monthly_fee, duration_days, is_active) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Basic', 'Perfect for new shopkeepers - 15% commission', 'percentage', 15, 0, 30, true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Pro', 'Best for growing businesses - 10% commission + analytics', 'percentage', 10, 0, 30, true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Premium', 'For large enterprises - 5% commission + all features', 'percentage', 5, 0, 30, true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Fixed Basic', 'Basic plan with fixed monthly fee', 'fixed_monthly', 0, 99, 30, true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Fixed Pro', 'Pro plan with fixed monthly fee', 'fixed_monthly', 0, 299, 30, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. ENSURE DEVICE_TOKENS TABLE EXISTS (for FCM/push notifications)
-- ============================================================

-- Note: user_tokens is orphaned - code uses device_tokens
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- User can manage own tokens
DROP POLICY IF EXISTS "Users manage own device_tokens" ON public.device_tokens;
CREATE POLICY "Users manage own device_tokens" ON public.device_tokens FOR ALL USING (user_id = auth.uid());

-- Admin can view all tokens
DROP POLICY IF EXISTS "Admin manages all device_tokens" ON public.device_tokens;
CREATE POLICY "Admin manages all device_tokens" ON public.device_tokens FOR ALL USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT 'Verification Results:' as status;

-- Check shop_documents columns
SELECT 'shop_documents columns:' as check;
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'shop_documents' AND table_schema = 'public' ORDER BY ordinal_position;

-- Check subscription_plans data
SELECT 'subscription_plans:' as check;
SELECT id, name, price, plan_type, is_active FROM public.subscription_plans;

-- Check complaints view
SELECT 'complaints view (from customer_complaints):' as check;
SELECT COUNT(*) as count FROM public.complaints;

SELECT '✅ All fixes applied successfully!' as status;