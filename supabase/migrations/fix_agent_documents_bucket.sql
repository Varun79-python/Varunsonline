-- ============================================================
-- FIX: Create agent-documents bucket and ensure it works
-- Run in Supabase SQL Editor
-- ============================================================

-- Insert bucket if missing
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-documents', 'agent-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Now make it private (update existing)
UPDATE storage.buckets
SET public = true
WHERE id = 'agent-documents';

-- Drop and recreate all policies for agent-documents
DROP POLICY IF EXISTS "Admins manage agent-docs" ON storage.objects;
DROP POLICY IF EXISTS "Agents upload agent-docs" ON storage.objects;
DROP POLICY IF EXISTS "Agents view agent-docs" ON storage.objects;
DROP POLICY IF EXISTS "Agents update agent-docs" ON storage.objects;
DROP POLICY IF EXISTS "Agents delete agent-docs" ON storage.objects;

-- Admin: full access
CREATE POLICY "Admins manage agent-docs" ON storage.objects FOR ALL
USING (bucket_id = 'agent-documents')
WITH CHECK (
  bucket_id = 'agent-documents' AND
  EXISTS (
    SELECT 1 FROM auth.users
    JOIN public.profiles ON profiles.id = auth.users.id
    WHERE auth.users.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Agents: upload to own folder
CREATE POLICY "Agents upload agent-docs" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'agent-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Agents: view own files
CREATE POLICY "Agents view agent-docs" ON storage.objects FOR SELECT
USING (
  bucket_id = 'agent-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Agents: update own files
CREATE POLICY "Agents update agent-docs" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'agent-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Agents: delete own files
CREATE POLICY "Agents delete agent-docs" ON storage.objects FOR DELETE
USING (
  bucket_id = 'agent-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Verify bucket exists
SELECT id, name, public FROM storage.buckets WHERE id = 'agent-documents';