-- Fix RLS policies for registration flow
-- ============================================================

-- Fix shop_documents table - allow shop owners to insert/update/delete their own documents
ALTER TABLE public.shop_documents ENABLE ROW LEVEL SECURITY;

-- Allow shop owners to insert documents for their own shop
DROP POLICY IF EXISTS "Shop owners can insert documents" ON public.shop_documents;
CREATE POLICY "Shop owners can insert documents" ON public.shop_documents FOR INSERT
WITH CHECK (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);

-- Allow shop owners to update their own documents
DROP POLICY IF EXISTS "Shop owners can update documents" ON public.shop_documents;
CREATE POLICY "Shop owners can update documents" ON public.shop_documents FOR UPDATE
USING (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);

-- Allow shop owners to delete their own documents  
DROP POLICY IF EXISTS "Shop owners can delete documents" ON public.shop_documents;
CREATE POLICY "Shop owners can delete documents" ON public.shop_documents FOR DELETE
USING (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);

-- Allow shop owners to view their own documents
DROP POLICY IF EXISTS "Shop owners can view documents" ON public.shop_documents;
CREATE POLICY "Shop owners can view documents" ON public.shop_documents FOR SELECT
USING (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);

-- Allow admins to view all documents
DROP POLICY IF EXISTS "Admins can view all shop documents" ON public.shop_documents;
CREATE POLICY "Admins can view all shop documents" ON public.shop_documents FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- Fix shops table RLS for owners to update
-- ============================================================

-- Allow shop owners to update their own shop
DROP POLICY IF EXISTS "Shop owners can update own shop" ON public.shops;
CREATE POLICY "Shop owners can update own shop" ON public.shops FOR UPDATE
USING (owner_id = auth.uid());

-- Allow shop owners to view their own shop
DROP POLICY IF EXISTS "Shop owners can view own shop" ON public.shops;
CREATE POLICY "Shop owners can view own shop" ON public.shops FOR SELECT
USING (owner_id = auth.uid());

-- ============================================================
-- Fix delivery_agents RLS
-- ============================================================

-- Allow agents to update their own record
DROP POLICY IF EXISTS "Agents can update self" ON public.delivery_agents;
CREATE POLICY "Agents can update self" ON public.delivery_agents FOR UPDATE
USING (id = auth.uid());

-- Allow agents to view their own record
DROP POLICY IF EXISTS "Agents can view self" ON public.delivery_agents;
CREATE POLICY "Agents can view self" ON public.delivery_agents FOR SELECT
USING (id = auth.uid());

-- ============================================================
-- Fix storage policies - more permissive for upload
-- ============================================================

-- Allow authenticated users to upload to shop-documents bucket
DROP POLICY IF EXISTS "Authenticated users can upload shop documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload shop documents" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'shop-documents' AND 
  (storage.foldername(name))[1]::uuid = auth.uid()
);

-- Allow authenticated users to view shop documents
DROP POLICY IF EXISTS "Authenticated users can view shop documents" ON storage.objects;
CREATE POLICY "Authenticated users can view shop documents" ON storage.objects FOR SELECT
USING (
  bucket_id = 'shop-documents' AND 
  (storage.foldername(name))[1]::uuid = auth.uid()
);

-- Allow authenticated users to upload to agent-documents bucket  
DROP POLICY IF EXISTS "Authenticated users can upload agent documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload agent documents" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'agent-documents' AND 
  (storage.foldername(name))[1]::uuid = auth.uid()
);

-- Allow authenticated users to view agent documents
DROP POLICY IF EXISTS "Authenticated users can view agent documents" ON storage.objects;
CREATE POLICY "Authenticated users can view agent documents" ON storage.objects FOR SELECT
USING (
  bucket_id = 'agent-documents' AND 
  (storage.foldername(name))[1]::uuid = auth.uid()
);

-- Allow authenticated users to upload to shop-images bucket
DROP POLICY IF EXISTS "Authenticated users can upload shop images" ON storage.objects;
CREATE POLICY "Authenticated users can upload shop images" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'shop-images' AND 
  (storage.foldername(name))[1]::uuid = auth.uid()
);