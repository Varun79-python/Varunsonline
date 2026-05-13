-- ============================================================
-- COMPREHENSIVE REGISTRATION & UPLOAD RLS FIX
-- ============================================================

-- ============================================================
-- 1. FIX SHOP-DOCUMENTS STORAGE BUCKET POLICIES
-- ============================================================

-- Allow authenticated users to upload to shop-documents bucket
-- They can upload to their own userId folder or their shop's folder
DROP POLICY IF EXISTS "Shop owners can upload documents" ON storage.objects;
CREATE POLICY "Shop owners can upload documents" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'shop-documents' AND (
    -- Allow upload to userId folder (for new registrations)
    auth.uid() = (storage.foldername(name))[1]::uuid
    OR
    -- Allow upload to shop folder (for existing shops)
    (
      -- Extract first folder as potential shop ID and check ownership
      (storage.foldername(name))[1]::uuid IN (
        SELECT id FROM public.shops WHERE owner_id = auth.uid()
      )
    )
  )
);

-- Allow users to view their own uploaded documents
DROP POLICY IF EXISTS "Shop owners can view own documents" ON storage.objects;
CREATE POLICY "Shop owners can view own documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'shop-documents' AND (
    -- User can view files in their userId folder
    auth.uid() = (storage.foldername(name))[1]::uuid
    OR
    -- User can view files in their shop's folder
    (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.shops WHERE owner_id = auth.uid()
    )
    OR
    -- Admins can view all
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
);

-- ============================================================
-- 2. FIX DELIVERY-DOCUMENTS STORAGE BUCKET POLICIES
-- ============================================================

-- Allow authenticated delivery agents to upload to delivery-documents bucket
DROP POLICY IF EXISTS "Delivery agents can upload documents" ON storage.objects;
CREATE POLICY "Delivery agents can upload documents" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'delivery-documents' AND (
    -- Allow upload to userId folder (their own folder)
    auth.uid() = (storage.foldername(name))[1]::uuid
    OR
    -- Allow upload to their delivery agent ID folder
    (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.delivery_agents WHERE id = auth.uid()
    )
  )
);

-- Allow users to view their own delivery documents
DROP POLICY IF EXISTS "Delivery agents can view own documents" ON storage.objects;
CREATE POLICY "Delivery agents can view own documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'delivery-documents' AND (
    auth.uid() = (storage.foldername(name))[1]::uuid
    OR
    (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.delivery_agents WHERE id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
);

-- ============================================================
-- 3. FIX SHOP_DOCUMENTS TABLE RLS FOR INSERT
-- ============================================================

-- Ensure INSERT policy exists for shop_documents
DROP POLICY IF EXISTS "Shop owners can insert own documents" ON public.shop_documents;
CREATE POLICY "Shop owners can insert own documents" ON public.shop_documents FOR INSERT
WITH CHECK (
  shop_id IN (
    SELECT id FROM public.shops WHERE owner_id = auth.uid()
  )
);

-- ============================================================
-- 4. ADD DELIVERY_AGENTS DOCUMENTS RLS
-- ============================================================

ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;

-- Agents can update their own documents
DROP POLICY IF EXISTS "Agents can update own records" ON public.delivery_agents;
CREATE POLICY "Agents can update own records" ON public.delivery_agents FOR UPDATE
USING (id = auth.uid());

-- Agents can select their own records
DROP POLICY IF EXISTS "Agents can view own records" ON public.delivery_agents;
CREATE POLICY "Agents can view own records" ON public.delivery_agents FOR SELECT
USING (id = auth.uid());

-- ============================================================
-- 5. ADD PROPER SESSION RECOVERY FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_registration_status(p_phone TEXT, p_email TEXT)
RETURNS TABLE (
  exists BOOLEAN,
  user_id UUID,
  user_type TEXT,
  registration_step TEXT,
  shop_id UUID,
  agent_id UUID,
  is_approved BOOLEAN,
  is_active BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user exists in auth.users by phone (via profiles)
  RETURN QUERY
  WITH auth_user AS (
    SELECT id FROM auth.users 
    WHERE phone = p_phone OR email = LOWER(p_email)
    LIMIT 1
  )
  SELECT 
    TRUE,
    au.id::UUID,
    p.role::TEXT,
    CASE 
      WHEN p.role = 'shopkeeper' AND s.id IS NOT NULL AND s.is_approved = false AND (
        SELECT COUNT(*) FROM public.shop_documents WHERE shop_id = s.id
      ) = 0 THEN 'documents_pending'
      WHEN p.role = 'shopkeeper' AND s.id IS NOT NULL AND s.is_approved = false THEN 'verification_pending'
      WHEN p.role = 'shopkeeper' AND s.is_approved = true THEN 'approved'
      WHEN p.role = 'delivery_agent' AND da.id IS NOT NULL AND da.is_approved = false AND (
        da.license_url IS NULL OR da.aadhar_url IS NULL
      ) THEN 'documents_pending'
      WHEN p.role = 'delivery_agent' AND da.id IS NOT NULL AND da.is_approved = false THEN 'verification_pending'
      WHEN p.role = 'delivery_agent' AND da.is_approved = true THEN 'approved'
      ELSE 'unknown'
    END,
    s.id::UUID,
    da.id::UUID,
    COALESCE(s.is_approved, false),
    COALESCE(s.is_active, false)
  FROM auth_user au
  LEFT JOIN public.profiles p ON p.id = au.id
  LEFT JOIN public.shops s ON s.owner_id = au.id
  LEFT JOIN public.delivery_agents da ON da.id = au.id
  WHERE au.id IS NOT NULL;
END;
$$;

-- Grant execute permission to anon and authenticated
GRANT EXECUTE ON FUNCTION public.check_registration_status TO anon, authenticated;

-- ============================================================
-- 6. ADD SHOP LOOKUP BY PHONE FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_shop_by_phone(p_phone TEXT)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  name TEXT,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  is_approved BOOLEAN,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.owner_id, s.name, s.full_name, s.phone, s.email, s.is_approved, s.is_active
  FROM public.shops s
  WHERE s.phone = p_phone;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_by_phone TO anon, authenticated;

-- ============================================================
-- 7. ADD DELIVERY AGENT LOOKUP BY PHONE FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_agent_by_phone(p_phone TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  is_approved BOOLEAN,
  is_active BOOLEAN,
  aadhar_url TEXT,
  license_url TEXT,
  vehicle_type TEXT,
  vehicle_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    da.id, 
    p.full_name, 
    p.phone, 
    p.email, 
    da.is_approved, 
    da.is_active,
    da.aadhar_url,
    da.license_url,
    da.vehicle_type,
    da.vehicle_number
  FROM public.delivery_agents da
  JOIN public.profiles p ON p.id = da.id
  WHERE p.phone = p_phone;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_by_phone TO anon, authenticated;