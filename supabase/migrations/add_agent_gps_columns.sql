-- ============================================================
-- Add missing last_lat / last_lon columns to delivery_agents
-- Required by autoAssignAgent (order-action/route.ts)
-- ============================================================

ALTER TABLE public.delivery_agents ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION;
ALTER TABLE public.delivery_agents ADD COLUMN IF NOT EXISTS last_lon DOUBLE PRECISION;

-- Update the existing test agent with location data
UPDATE public.delivery_agents
SET last_lat = 17.9317, last_lon = 83.4213, is_available = true
WHERE email = 'testdelivery.varun@outlook.com';
