-- ============================================================
-- FIX: delivery_agents RLS policies
-- Ensures agents can view/update their own records and admins can manage all
-- Run this in Supabase SQL Editor
-- ============================================================

-- Remove duplicate RLS enable (handled in main schema)
-- ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Agent views own profile" ON public.delivery_agents;
DROP POLICY IF EXISTS "Agents can update own records" ON public.delivery_agents;
DROP POLICY IF EXISTS "Agents can view own records" ON public.delivery_agents;
DROP POLICY IF EXISTS "Admin manages agents" ON public.delivery_agents;

-- Agent can SELECT their own record
CREATE POLICY "Agents can view own records" ON public.delivery_agents FOR SELECT
USING (id = auth.uid());

-- Agent can UPDATE their own record (for uploading documents, etc.)
CREATE POLICY "Agents can update own records" ON public.delivery_agents FOR UPDATE
USING (id = auth.uid());

-- Agent can UPSERT/INSERT their own record (for registration)
DROP POLICY IF EXISTS "Agents can insert own records" ON public.delivery_agents;
CREATE POLICY "Agents can insert own records" ON public.delivery_agents FOR INSERT
WITH CHECK (id = auth.uid());

-- Also allow upsert (INSERT with ON CONFLICT)
DROP POLICY IF EXISTS "Agents can upsert own records" ON public.delivery_agents;
CREATE POLICY "Agents can upsert own records" ON public.delivery_agents FOR INSERT
WITH CHECK (id = auth.uid());

-- Admin can do everything
CREATE POLICY "Admin manages agents" ON public.delivery_agents FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));