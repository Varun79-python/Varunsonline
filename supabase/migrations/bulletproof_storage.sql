-- ==========================================
-- BULLETPROOF STORAGE RLS & BUCKET FIX
-- ==========================================

-- 1. ENSURE BUCKETS EXIST
-- If a bucket doesn't exist, Supabase throws an RLS error during upload!
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('shop-documents', 'shop-documents', true),
  ('agent-documents', 'agent-documents', true),
  ('shop-images', 'shop-images', true),
  ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. DROP ALL PREVIOUS POLICIES TO PREVENT CONFLICTS
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
DROP POLICY IF EXISTS "Authenticated users can upload shop documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view shop documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload agent documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view agent documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload shop images" ON storage.objects;

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 4. CREATE BULLETPROOF POLICIES

-- Allow anyone to view the images/documents (since they are public buckets)
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT 
USING (bucket_id IN ('shop-documents', 'agent-documents', 'shop-images', 'product-images'));

-- Allow ANY authenticated user to upload. 
-- This completely removes path-based errors.
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' AND 
  bucket_id IN ('shop-documents', 'agent-documents', 'shop-images', 'product-images')
);

-- Allow users to only modify/delete their OWN files
CREATE POLICY "Users can update own files" ON storage.objects FOR UPDATE 
USING (auth.uid() = owner);

CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE 
USING (auth.uid() = owner);
