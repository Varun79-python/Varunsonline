BEGIN;

-- 1. Add user_id and status to shop_documents
ALTER TABLE public.shop_documents 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- 2. Allow shop_id to be null
ALTER TABLE public.shop_documents ALTER COLUMN shop_id DROP NOT NULL;

-- 3. Update RLS policies for shop_documents table
DROP POLICY IF EXISTS "Shop owner views own documents" ON public.shop_documents;
CREATE POLICY "Shop owner views own documents" ON public.shop_documents FOR SELECT USING (
  user_id = auth.uid() OR 
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Shop owner uploads own documents" ON public.shop_documents;
CREATE POLICY "Shop owner uploads own documents" ON public.shop_documents FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "Shop owners can insert own documents" ON public.shop_documents;

-- 4. Ensure storage policies exist for the shop-documents bucket
-- This ensures users can upload directly to their user.id folder
DROP POLICY IF EXISTS "Users can upload to their own folder in shop-documents" ON storage.objects;
CREATE POLICY "Users can upload to their own folder in shop-documents" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'shop-documents' AND (
    auth.uid() = (storage.foldername(name))[1]::uuid
  )
);

DROP POLICY IF EXISTS "Anyone can view shop-documents" ON storage.objects;
CREATE POLICY "Anyone can view shop-documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'shop-documents'
);

COMMIT;
