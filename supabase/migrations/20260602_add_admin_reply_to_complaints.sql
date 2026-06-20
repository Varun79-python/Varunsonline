-- Add admin reply column to customer_complaints for admin response functionality
ALTER TABLE public.customer_complaints ADD COLUMN IF NOT EXISTS admin_reply TEXT;
ALTER TABLE public.customer_complaints ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
