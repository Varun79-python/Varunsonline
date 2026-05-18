-- ============================================================
-- FIX: Storage Security - Remove broad SELECT policies
-- This removes the ability for anyone to list all files in buckets
-- ============================================================

-- Drop ALL existing SELECT policies first
DROP POLICY IF EXISTS "Public can view shop documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view shop images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view agent documents" ON storage.objects;
DROP POLICY IF EXISTS "shop_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "shop_images_select_own" ON storage.objects;
DROP POLICY IF EXISTS "product_images_select_own" ON storage.objects;
DROP POLICY IF EXISTS "agent_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "admin_storage_select" ON storage.objects;

-- Create more restrictive SELECT policies that don't allow listing
-- Users can only access their own files by knowing the exact path

-- For shop-documents: users can only access files they uploaded (by path)
CREATE POLICY "shop_docs_select_own" ON storage.objects FOR SELECT 
USING (
  bucket_id = 'shop-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- For shop-images
CREATE POLICY "shop_images_select_own" ON storage.objects FOR SELECT 
USING (
  bucket_id = 'shop-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- For product-images
CREATE POLICY "product_images_select_own" ON storage.objects FOR SELECT 
USING (
  bucket_id = 'product-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- For agent-documents
CREATE POLICY "agent_docs_select_own" ON storage.objects FOR SELECT 
USING (
  bucket_id = 'agent-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admin can view all files (for admin panel to work)
CREATE POLICY "admin_storage_select" ON storage.objects FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Verify the policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;