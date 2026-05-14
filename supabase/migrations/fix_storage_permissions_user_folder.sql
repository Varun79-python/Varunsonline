-- ============================================================
-- FIX: Storage Permissions for User ID Folder Upload
-- This migration fixes the "storage permissions denied" error
-- by allowing authenticated users to upload to their user ID folder
-- ============================================================

-- 1. Ensure all buckets exist and are public
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('shop-documents', 'shop-documents', true),
  ('shop-images', 'shop-images', true),
  ('product-images', 'product-images', true),
  ('agent-documents', 'agent-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Make sure buckets are public
UPDATE storage.buckets SET public = true WHERE id IN ('shop-documents', 'shop-images', 'product-images', 'agent-documents');

-- 2. Drop all existing storage policies that might conflict
DROP POLICY IF EXISTS "Public can view shop images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view shop documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view agent documents" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update own folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete own folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload to own product folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update own product folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete own product folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all shop images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all shop documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all agent documents" ON storage.objects;

-- Drop policies from other migration files
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload to user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload shop images to user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update shop images user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete shop images user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload product images to user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update product images user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete product images user folder" ON storage.objects;
DROP POLICY IF EXISTS "Agents can upload to user folder" ON storage.objects;
DROP POLICY IF EXISTS "Agents can update user folder" ON storage.objects;
DROP POLICY IF EXISTS "Agents can delete user folder" ON storage.objects;

-- 3. Create simple, working policies

-- SHOP-DOCUMENTS: Allow authenticated users to upload to their user ID folder
-- The code uploads to: {user.id}/{docType}_{timestamp}.{ext}
CREATE POLICY "Shop owners can upload documents to user folder" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'shop-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Shop owners can update documents in user folder" ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'shop-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Shop owners can delete documents in user folder" ON storage.objects FOR DELETE 
USING (
  bucket_id = 'shop-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- SHOP-IMAGES: Allow authenticated users to upload to their user ID folder
CREATE POLICY "Shop owners can upload images to user folder" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'shop-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Shop owners can update images in user folder" ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'shop-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Shop owners can delete images in user folder" ON storage.objects FOR DELETE 
USING (
  bucket_id = 'shop-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- PRODUCT-IMAGES: Allow authenticated users to upload to their user ID folder
CREATE POLICY "Shop owners can upload product images to user folder" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'product-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Shop owners can update product images in user folder" ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'product-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Shop owners can delete product images in user folder" ON storage.objects FOR DELETE 
USING (
  bucket_id = 'product-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- AGENT-DOCUMENTS: Allow authenticated users to upload to their user ID folder
CREATE POLICY "Agents can upload documents to user folder" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'agent-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Agents can update documents in user folder" ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'agent-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Agents can delete documents in user folder" ON storage.objects FOR DELETE 
USING (
  bucket_id = 'agent-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Public read access for all buckets (for displaying images/documents)
CREATE POLICY "Public can view shop documents" ON storage.objects FOR SELECT 
USING (bucket_id = 'shop-documents');

CREATE POLICY "Public can view shop images" ON storage.objects FOR SELECT 
USING (bucket_id = 'shop-images');

CREATE POLICY "Public can view product images" ON storage.objects FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Public can view agent documents" ON storage.objects FOR SELECT 
USING (bucket_id = 'agent-documents');

-- 5. Admin access (for managing all files)
-- Admins can manage all storage objects
CREATE POLICY "Admins can manage all storage" ON storage.objects FOR ALL 
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 6. Verify the setup
SELECT id, name, public FROM storage.buckets WHERE id IN ('shop-documents', 'shop-images', 'product-images', 'agent-documents');

SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';