-- Fix customers table RLS - only admin can read all customers
-- Drop existing policies and add proper ones

DROP POLICY IF EXISTS "Customer views own profile" ON public.customers;
DROP POLICY IF EXISTS "Customer reads own profile" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can read customers" ON public.customers;
DROP POLICY IF EXISTS "Admin manages customers" ON public.customers;

-- Only admin can read all customers (checks profiles table for admin role)
CREATE POLICY "Admin can read customers" ON public.customers
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Customers can only update their own profile
CREATE POLICY "Customers can update own profile" ON public.customers
FOR UPDATE USING (auth.uid() = id);

-- Customers can only insert their own profile
CREATE POLICY "Customers can insert own profile" ON public.customers
FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin has full access
CREATE POLICY "Admin manages customers" ON public.customers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);