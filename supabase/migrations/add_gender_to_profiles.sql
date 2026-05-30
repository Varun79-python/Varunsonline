-- Add gender field to profiles table (includes prefer_not_to_say)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

-- Add gender field to shops table for shopkeeper gender
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS owner_gender TEXT CHECK (owner_gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

-- Add gender field to delivery_agents table
ALTER TABLE public.delivery_agents ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

-- Also allow NULL/empty to avoid constraint violations on initial save
ALTER TABLE public.profiles ALTER COLUMN gender DROP NOT NULL;
ALTER TABLE public.shops ALTER COLUMN owner_gender DROP NOT NULL;
ALTER TABLE public.delivery_agents ALTER COLUMN gender DROP NOT NULL;