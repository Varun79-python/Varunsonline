-- ============================================================
-- FIX: Update is_admin() function to also check JWT claims
-- The existing function only checks profiles.role, but the admin
-- user's profile may not have role='admin' set (the client-side
-- login uses email fallback which may fail due to RLS on profiles).
-- ============================================================

-- Update the is_admin() function to check profiles table AND JWT claims
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  _jwt json;
  _profile_role TEXT;
BEGIN
  -- Check 1: Profiles table (existing logic)
  SELECT role INTO _profile_role FROM public.profiles WHERE id = auth.uid();
  IF _profile_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Check 2: JWT claims — raw_user_meta_data or raw_app_meta_data may have role
  BEGIN
    _jwt := auth.jwt();
    IF _jwt IS NOT NULL THEN
      -- Check email match with admin email
      IF _jwt->>'email' = 'venkatavarun79@gmail.com' THEN
        RETURN TRUE;
      END IF;
      -- Check role in app_metadata or user_metadata
      IF _jwt->>'role' = 'admin' THEN
        RETURN TRUE;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If auth.jwt() fails (e.g. not authenticated), fall through to FALSE
    NULL;
  END;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
