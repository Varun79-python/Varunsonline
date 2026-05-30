-- ============================================================
-- Migration: Add PAN URL and Vehicle RC URL columns
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add missing document URL columns to delivery_agents
-- Admin agents page and existingUserDetection expect these
ALTER TABLE public.delivery_agents
  ADD COLUMN IF NOT EXISTS pan_url TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_rc_url TEXT;

-- Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'delivery_agents' 
  AND column_name IN ('pan_url', 'vehicle_rc_url', 'aadhar_url', 'license_url', 'live_photo_url')
ORDER BY column_name;
