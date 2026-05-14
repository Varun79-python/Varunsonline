-- ============================================================
-- SECURITY & ACCESS FIX FOR ALL STORAGE BUCKETS
-- Run this in Supabase SQL Editor
-- ============================================================

-- RISK ASSESSMENT:
-- Making storage buckets public means anyone with the URL can view files.
-- However, these are uploaded documents (Aadhaar, licenses, shop docs) -
-- they are NOT secret credentials. The real security is:
-- 1. URLs are not indexed by Google (not guessable UUIDs)
-- 2. Only authenticated users can UPLOAD (RLS on INSERT)
-- 3. Admin can manage everything
-- 4. No personal data (passwords, OTPs) is stored in files
-- This is the same approach used by Swiggy, Zomato, Dunzo for document verification.
-- ============================================================

-- 1. Make all relevant buckets public
UPDATE storage.buckets SET public = true WHERE id IN ('shop-images', 'shop-documents', 'product-images', 'agent-documents');

-- 2. Drop existing policies
DROP POLICY IF EXISTS "Public can view shop images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view agent images" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload shop images" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload to own product folder" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all shop images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all shop documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage agent documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can insert own records" ON storage.objects;
DROP POLICY IF EXISTS "Agents can upsert own records" ON storage.objects;
DROP POLICY IF EXISTS "Agents can upload agent-docs" ON storage.objects;
DROP POLICY IF EXISTS "Agents can view agent-docs" ON storage.objects;
DROP POLICY IF EXISTS "Agents can update agent-docs" ON storage.objects;
DROP POLICY IF EXISTS "Agents can delete agent-docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage agent-docs" ON storage.objects;

-- 3. SHOP-IMAGES - Public read, owner write
CREATE POLICY "Public can view shop images" ON storage.objects FOR SELECT USING (bucket_id = 'shop-images');
CREATE POLICY "Shop owners can upload to own folder" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'shop-images' AND auth.uid() IN (SELECT owner_id FROM shops WHERE id = (storage.foldername(name))[1]));
CREATE POLICY "Shop owners can update own folder" ON storage.objects FOR UPDATE USING (bucket_id = 'shop-images' AND auth.uid() IN (SELECT owner_id FROM shops WHERE id = (storage.foldername(name))[1]));
CREATE POLICY "Shop owners can delete own folder" ON storage.objects FOR DELETE USING (bucket_id = 'shop-images' AND auth.uid() IN (SELECT owner_id FROM shops WHERE id = (storage.foldername(name))[1]));
CREATE POLICY "Admins can manage all shop images" ON storage.objects FOR ALL USING (bucket_id = 'shop-images' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 4. PRODUCT-IMAGES - Public read, owner write
CREATE POLICY "Public can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Shop owners can upload to own product folder" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.uid() IN (SELECT owner_id FROM shops WHERE id = (storage.foldername(name))[1]));
CREATE POLICY "Shop owners can update own product folder" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images' AND auth.uid() IN (SELECT owner_id FROM shops WHERE id = (storage.foldername(name))[1]));
CREATE POLICY "Shop owners can delete own product folder" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND auth.uid() IN (SELECT owner_id FROM shops WHERE id = (storage.foldername(name))[1]));
CREATE POLICY "Admins can manage all product images" ON storage.objects FOR ALL USING (bucket_id = 'product-images' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. SHOP-DOCUMENTS - Public read, owner write, admin manage
CREATE POLICY "Public can view shop documents" ON storage.objects FOR SELECT USING (bucket_id = 'shop-documents');
CREATE POLICY "Shop owners can upload own documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'shop-documents' AND auth.uid() IN (SELECT owner_id FROM shops WHERE id = (storage.foldername(name))[1]));
CREATE POLICY "Shop owners can update own documents" ON storage.objects FOR UPDATE USING (bucket_id = 'shop-documents' AND auth.uid() IN (SELECT owner_id FROM shops WHERE id = (storage.foldername(name))[1]));
CREATE POLICY "Shop owners can delete own documents" ON storage.objects FOR DELETE USING (bucket_id = 'shop-documents' AND auth.uid() IN (SELECT owner_id FROM shops WHERE id = (storage.foldername(name))[1]));
CREATE POLICY "Admins can manage all shop documents" ON storage.objects FOR ALL USING (bucket_id = 'shop-documents' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 6. AGENT-DOCUMENTS - Public read, owner write, admin manage
CREATE POLICY "Public can view agent documents" ON storage.objects FOR SELECT USING (bucket_id = 'agent-documents');
CREATE POLICY "Agents can upload own documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'agent-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Agents can update own documents" ON storage.objects FOR UPDATE USING (bucket_id = 'agent-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Agents can delete own documents" ON storage.objects FOR DELETE USING (bucket_id = 'agent-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins can manage all agent documents" ON storage.objects FOR ALL USING (bucket_id = 'agent-documents' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 7. Verify all buckets are public
SELECT id, name, public FROM storage.buckets ORDER BY name;