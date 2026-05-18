-- ============================================================
-- FIX ADMIN PANEL ISSUES - Run this in Supabase SQL Editor
-- Fixes: Missing columns, FK relationships, RLS policies
-- ============================================================

BEGIN;

-- 1. Add missing columns to shop_documents table
ALTER TABLE public.shop_documents 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS shop_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS aadhar_url TEXT;

-- 2. Make shop_id nullable (allows documents without shop)
ALTER TABLE public.shop_documents ALTER COLUMN shop_id DROP NOT NULL;

-- 3. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shop_documents_user_id ON public.shop_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_documents_status ON public.shop_documents(status);

-- 4. Create is_admin() function for RLS (if not exists)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update RLS policies for shop_documents

-- Enable RLS if not enabled
ALTER TABLE public.shop_documents ENABLE ROW LEVEL SECURITY;

-- Admin can view/manage all documents
DROP POLICY IF EXISTS "Admin manages all shop documents" ON public.shop_documents;
CREATE POLICY "Admin manages all shop documents" ON public.shop_documents FOR ALL USING (public.is_admin());

-- Users can view their own documents
DROP POLICY IF EXISTS "Users can view own shop documents" ON public.shop_documents;
CREATE POLICY "Users can view own shop documents" ON public.shop_documents FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own documents
DROP POLICY IF EXISTS "Users can insert own shop documents" ON public.shop_documents;
CREATE POLICY "Users can insert own shop documents" ON public.shop_documents FOR INSERT WITH CHECK (user_id = auth.uid());

-- 6. Fix profiles RLS for admin access
DROP POLICY IF EXISTS "Admin sees all profiles" ON public.profiles;
CREATE POLICY "Admin sees all profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- 7. Fix shops RLS for admin access
DROP POLICY IF EXISTS "Admin manages all shops" ON public.shops;
CREATE POLICY "Admin manages all shops" ON public.shops FOR ALL USING (public.is_admin());

-- 8. Fix customers table RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manages customers" ON public.customers;
CREATE POLICY "Admin manages customers" ON public.customers FOR ALL USING (public.is_admin());

COMMIT;

-- Verify the fix
SELECT 
  'shop_documents columns' as check_type,
  column_name 
FROM information_schema.columns 
WHERE table_name = 'shop_documents' AND table_schema = 'public';