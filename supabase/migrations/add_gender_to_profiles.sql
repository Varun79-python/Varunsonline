-- Add gender field to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other'));

-- Add gender field to shops table for shopkeeper gender
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS owner_gender TEXT CHECK (owner_gender IN ('male', 'female', 'other'));

-- Add gender field to delivery_agents table
ALTER TABLE public.delivery_agents ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other'));