-- Add is_profile_complete flag to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_profile_complete BOOLEAN DEFAULT FALSE;

-- Update existing approved shops to be profile complete (backward compatibility)
UPDATE shops SET is_profile_complete = true WHERE is_approved = true AND is_active = true;