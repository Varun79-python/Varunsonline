-- ============================================================
-- FIX ADMIN RLS RECURSION AND VISIBILITY
-- ============================================================

-- 1. Create a security definer function to check for admin role
-- This avoids RLS recursion because SECURITY DEFINER functions
-- run with the privileges of the creator (postgres) and bypass RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix PROFILES policies
DROP POLICY IF EXISTS "Admin sees all profiles" ON public.profiles;
CREATE POLICY "Admin sees all profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- 3. Fix SHOPS policies
DROP POLICY IF EXISTS "Admin manages all shops" ON public.shops;
CREATE POLICY "Admin manages all shops" ON public.shops FOR ALL USING (public.is_admin());

-- 4. Fix SHOP_DOCUMENTS policies
-- Ensure admins can see documents even if they don't own the shop
DROP POLICY IF EXISTS "Admin views all documents" ON public.shop_documents;
DROP POLICY IF EXISTS "Admins can view all shop documents" ON public.shop_documents;
DROP POLICY IF EXISTS "Admins can manage shop documents" ON public.shop_documents;
CREATE POLICY "Admin manages all shop documents" ON public.shop_documents FOR ALL USING (public.is_admin());

-- 5. Fix DELIVERY_AGENTS policies
DROP POLICY IF EXISTS "Admin manages agents" ON public.delivery_agents;
CREATE POLICY "Admin manages all agents" ON public.delivery_agents FOR ALL USING (public.is_admin());

-- 6. Fix OTHER tables that might need admin access
-- Orders
DROP POLICY IF EXISTS "Admin views all orders" ON public.orders;
CREATE POLICY "Admin manages all orders" ON public.orders FOR ALL USING (public.is_admin());

-- Order Items
DROP POLICY IF EXISTS "Admin reads all order items" ON public.order_items;
CREATE POLICY "Admin manages all order items" ON public.order_items FOR ALL USING (public.is_admin());

-- Reviews
DROP POLICY IF EXISTS "Admin manages reviews" ON public.reviews;
CREATE POLICY "Admin manages all reviews" ON public.reviews FOR ALL USING (public.is_admin());

-- Withdraw Requests
DROP POLICY IF EXISTS "Admin manages withdrawals" ON public.withdraw_requests;
CREATE POLICY "Admin manages all withdrawals" ON public.withdraw_requests FOR ALL USING (public.is_admin());

-- Wallet Transactions
DROP POLICY IF EXISTS "Admin manages wallets" ON public.wallet_transactions;
CREATE POLICY "Admin manages all wallet transactions" ON public.wallet_transactions FOR ALL USING (public.is_admin());

-- Coupons
DROP POLICY IF EXISTS "Admin manages coupons" ON public.coupons;
CREATE POLICY "Admin manages all coupons" ON public.coupons FOR ALL USING (public.is_admin());

-- Platform Settings
DROP POLICY IF EXISTS "Admin manages settings" ON public.platform_settings;
CREATE POLICY "Admin manages all platform settings" ON public.platform_settings FOR ALL USING (public.is_admin());

-- Complaints (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'complaints') THEN
        DROP POLICY IF EXISTS "Admin manages complaints" ON public.complaints;
        EXECUTE 'CREATE POLICY "Admin manages all complaints" ON public.complaints FOR ALL USING (public.is_admin())';
    END IF;
END $$;
