-- Fix customers table RLS to allow authenticated users to read
-- Drop existing restrictive policies and add permissive ones

-- Allow authenticated users to read all customers (for admin panel)
DROP POLICY IF EXISTS "Customer views own profile" ON public.customers;
DROP POLICY IF EXISTS "Customer reads own profile" ON public.customers;

CREATE POLICY "Authenticated users can read customers" ON public.customers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Customers can update own profile" ON public.customers
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Customers can insert own profile" ON public.customers
FOR INSERT WITH CHECK (auth.uid() = id);

-- Keep admin full access
DROP POLICY IF EXISTS "Admin manages customers" ON public.customers;
CREATE POLICY "Admin manages customers" ON public.customers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);