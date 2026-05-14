-- ============================================================
-- FIX: Storage Upload RLS Policy
-- Fixes "new row violates row-level security policy" error
-- ============================================================

-- First, let's check current policies on storage.objects
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects';

-- Drop existing restrictive policies for shop-documents
DROP POLICY IF EXISTS "Shop owners can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete own documents" ON storage.objects;

-- Drop existing restrictive policies for shop-images
DROP POLICY IF EXISTS "Shop owners can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update own folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete own folder" ON storage.objects;

-- Drop existing restrictive policies for product-images
DROP POLICY IF EXISTS "Shop owners can upload to own product folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update own product folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete own product folder" ON storage.objects;

-- Drop existing restrictive policies for agent-documents
DROP POLICY IF EXISTS "Agents can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can delete own documents" ON storage.objects;

-- ============================================================
-- NEW POLICIES: Allow authenticated users to upload to their own user ID folder
-- This is more permissive but solves the RLS issue during registration
-- ============================================================

-- SHOP DOCUMENTS: Allow authenticated users to upload to folder named after their user ID
-- The upload path should be: {userId}/{filename}
CREATE POLICY "Shop owners can upload to user folder" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'shop-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Shop owners can update user folder" ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'shop-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Shop owners can delete user folder" ON storage.objects FOR DELETE 
USING (
  bucket_id = 'shop-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- SHOP IMAGES: Allow authenticated users to upload to folder named after their user ID
CREATE POLICY "Shop owners can upload shop images to user folder" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'shop-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Shop owners can update shop images user folder" ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'shop-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Shop owners can delete shop images user folder" ON storage.objects FOR DELETE 
USING (
  bucket_id = 'shop-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- PRODUCT IMAGES: Allow authenticated users to upload to folder named after their user ID
CREATE POLICY "Shop owners can upload product images to user folder" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'product-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Shop owners can update product images user folder" ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'product-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Shop owners can delete product images user folder" ON storage.objects FOR DELETE 
USING (
  bucket_id = 'product-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- AGENT DOCUMENTS: Allow authenticated users to upload to folder named after their user ID
CREATE POLICY "Agents can upload to user folder" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'agent-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Agents can update user folder" ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'agent-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Agents can delete user folder" ON storage.objects FOR DELETE 
USING (
  bucket_id = 'agent-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admin policies remain the same
DROP POLICY IF EXISTS "Admins can manage all shop images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all shop documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all agent documents" ON storage.objects;

CREATE POLICY "Admins can manage all shop images" ON storage.objects FOR ALL 
USING (bucket_id = 'shop-images' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage all product images" ON storage.objects FOR ALL 
USING (bucket_id = 'product-images' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage all shop documents" ON storage.objects FOR ALL 
USING (bucket_id = 'shop-documents' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage all agent documents" ON storage.objects FOR ALL 
USING (bucket_id = 'agent-documents' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Verify policies
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'objects' AND schema = 'storage';