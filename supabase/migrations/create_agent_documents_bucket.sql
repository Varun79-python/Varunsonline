-- ============================================================
-- FIX: Create agent-documents storage bucket if missing
-- Run this in Supabase SQL Editor
-- ============================================================

-- Insert agent-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-documents', 'agent-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies for agent-documents
DROP POLICY IF EXISTS "Agents can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage agent documents" ON storage.objects;

-- Agents can upload to their own folder {agentId}/
CREATE POLICY "Agents can upload own documents" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'agent-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Agents can view their own documents
CREATE POLICY "Agents can view own documents" ON storage.objects FOR SELECT
USING (
  bucket_id = 'agent-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Agents can update their own documents
CREATE POLICY "Agents can update own documents" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'agent-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Agents can delete their own documents
CREATE POLICY "Agents can delete own documents" ON storage.objects FOR DELETE
USING (
  bucket_id = 'agent-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can manage all agent documents
CREATE POLICY "Admins can manage agent documents" ON storage.objects FOR ALL
USING (
  bucket_id = 'agent-documents' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);