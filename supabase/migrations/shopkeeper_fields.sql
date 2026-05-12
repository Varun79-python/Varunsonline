-- Add full_name and terms_accepted to shops table
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;