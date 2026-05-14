-- ============================================================
-- CLEAN UP: Remove all old conflicting storage policies
-- ============================================================

-- Drop ALL existing storage policies on storage.objects
DROP POLICY IF EXISTS "Admins manage agent-docs" ON storage.objects;
DROP POLICY IF EXISTS "Agents can delete documents in user folder" ON storage.objects;
DROP POLICY IF EXISTS "Agents can update documents in user folder" ON storage.objects;
DROP POLICY IF EXISTS "Agents can upload documents to user folder" ON storage.objects;
DROP POLICY IF EXISTS "Agents can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents delete agent-docs" ON storage.objects;
DROP POLICY IF EXISTS "Agents update agent-docs" ON storage.objects;
DROP POLICY IF EXISTS "Agents upload agent-docs" ON storage.objects;
DROP POLICY IF EXISTS "Agents view agent-docs" ON storage.objects;
DROP POLICY IF EXISTS "Public can view agent documents" ON storage.objects;

DROP POLICY IF EXISTS "Admins can manage all documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view shop documents" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete documents in user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update documents in user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload documents to user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can view own documents" ON storage.objects;

DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete product images in user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update product images in user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload product images to user folder" ON storage.objects;

DROP POLICY IF EXISTS "Public can view shop images" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete images in user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update images in user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload images to user folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload shop images" ON storage.objects;

DROP POLICY IF EXISTS "Admins can manage all storage" ON storage.objects;

-- ============================================================
-- CREATE CLEAN POLICIES
-- ============================================================

-- 1. SHOP-DOCUMENTS: Allow authenticated users to upload to their user ID folder
CREATE POLICY "shop_docs_insert" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'shop-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "shop_docs_select" ON storage.objects FOR SELECT 
USING (bucket_id = 'shop-documents');

CREATE POLICY "shop_docs_update" ON storage.objects FOR UPDATE 
USING (bucket_id = 'shop-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "shop_docs_delete" ON storage.objects FOR DELETE 
USING (bucket_id = 'shop-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 2. SHOP-IMAGES
CREATE POLICY "shop_images_insert" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'shop-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "shop_images_select" ON storage.objects FOR SELECT 
USING (bucket_id = 'shop-images');

CREATE POLICY "shop_images_update" ON storage.objects FOR UPDATE 
USING (bucket_id = 'shop-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "shop_images_delete" ON storage.objects FOR DELETE 
USING (bucket_id = 'shop-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3. PRODUCT-IMAGES
CREATE POLICY "product_images_insert" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'product-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "product_images_select" ON storage.objects FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "product_images_update" ON storage.objects FOR UPDATE 
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "product_images_delete" ON storage.objects FOR DELETE 
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. AGENT-DOCUMENTS
CREATE POLICY "agent_docs_insert" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'agent-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "agent_docs_select" ON storage.objects FOR SELECT 
USING (bucket_id = 'agent-documents');

CREATE POLICY "agent_docs_update" ON storage.objects FOR UPDATE 
USING (bucket_id = 'agent-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "agent_docs_delete" ON storage.objects FOR DELETE 
USING (bucket_id = 'agent-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. ADMIN ACCESS (for all buckets)
CREATE POLICY "admin_storage_all" ON storage.objects FOR ALL 
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Verify
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY policyname;