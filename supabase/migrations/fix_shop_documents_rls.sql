-- Fix RLS policies for shop documents and storage uploads during registration

-- ============================================================
-- 1. Add INSERT policy for shop_documents table
-- ============================================================

-- Shop owners can insert documents for their own shop
CREATE POLICY "Shop owners can insert own documents" ON public.shop_documents FOR INSERT
WITH CHECK (
  shop_id IN (
    SELECT id FROM public.shops WHERE owner_id = auth.uid()
  )
);

-- ============================================================
-- 2. Fix storage policy to allow uploads during registration
-- ============================================================

-- Allow authenticated users to upload to their userId folder during registration
-- Also allow uploads to shopId folder (existing policy)
DROP POLICY IF EXISTS "Shop owners can upload to own folder" ON storage.objects;
CREATE POLICY "Shop owners can upload to own folder" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'shop-images' AND (
    -- Allow upload to shop folder (existing logic)
    auth.uid() IN (SELECT owner_id FROM shops WHERE id = (storage.foldername(name))[1])
    OR
    -- Allow upload to userId folder during registration (before shop is fully set up)
    auth.uid() = (storage.foldername(name))[1]::uuid
  )
);

-- Similarly fix product-images bucket
DROP POLICY IF EXISTS "Shop owners can upload to own product folder" ON storage.objects;
CREATE POLICY "Shop owners can upload to own product folder" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'product-images' AND (
    auth.uid() IN (SELECT owner_id FROM shops WHERE id = (storage.foldername(name))[1])
    OR
    auth.uid() = (storage.foldername(name))[1]::uuid
  )
);