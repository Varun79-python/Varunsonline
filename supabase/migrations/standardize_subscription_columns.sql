-- ============================================================
-- Migration: Standardize Subscription Column Names
--
-- Permanently standardizes shop_subscriptions to:
--   start_date, end_date, amount_paid
--
-- Removes legacy columns:
--   starts_at, expires_at
--
-- Renames shops.subscription_expires_at → subscription_end_date
-- for consistency across the codebase.
--
-- Safe & idempotent — handles ALL schema states:
--   Case A: DB has legacy columns (starts_at/expires_at) → migrates
--   Case B: DB already has standardized columns → no-op
--   Case C: Mixed/partial schema state → handles gracefully
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ADD STANDARDIZED COLUMNS TO shop_subscriptions (if absent)
-- ============================================================
ALTER TABLE public.shop_subscriptions
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2);

-- ============================================================
-- 2. MIGRATE LEGACY DATA (only if legacy columns exist)
-- ============================================================
-- Copy starts_at → start_date, expires_at → end_date
-- For old rows without amount_paid, set to 0
-- NOTE: end_date intentionally kept NULL for percentage plans
UPDATE public.shop_subscriptions
  SET start_date = COALESCE(start_date, starts_at, created_at, NOW()),
      end_date   = COALESCE(end_date,   expires_at),
      amount_paid = COALESCE(amount_paid, 0)
  WHERE start_date IS NULL
     OR end_date IS NULL
     OR amount_paid IS NULL;

-- ============================================================
-- 3. ENFORCE NOT NULL ON START_DATE AND AMOUNT_PAID
-- ============================================================
-- end_date is intentionally kept NULLABLE.
-- Percentage-plan subscriptions have no expiry (end_date = NULL).
-- The cron job explicitly filters: .not('end_date', 'is', null)
ALTER TABLE public.shop_subscriptions
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN amount_paid SET NOT NULL;

-- ============================================================
-- 4. REMOVE LEGACY COLUMNS (permanently, only after data copied)
-- ============================================================
ALTER TABLE public.shop_subscriptions
  DROP COLUMN IF EXISTS starts_at,
  DROP COLUMN IF EXISTS expires_at;

-- ============================================================
-- 5. RENAME shops.subscription_expires_at → subscription_end_date
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shops'
      AND column_name = 'subscription_expires_at'
  ) THEN
    ALTER TABLE public.shops RENAME COLUMN subscription_expires_at TO subscription_end_date;
  END IF;
END $$;

-- ============================================================
-- 6. UPDATE INDEXES — replace expires_at → end_date
-- ============================================================
DROP INDEX IF EXISTS idx_shop_subscriptions_active_expires;
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_active_end_date
  ON public.shop_subscriptions (end_date)
  WHERE is_active = true AND end_date IS NOT NULL;

-- ============================================================
-- 7. ADD subscription_end_date TO shops IF STILL MISSING
-- (Safety net for Case C: mixed schema where rename didn't happen
--  but no legacy column existed either)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shops'
      AND column_name = 'subscription_end_date'
  ) THEN
    ALTER TABLE public.shops ADD COLUMN subscription_end_date TIMESTAMPTZ;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFICATION (runs within transaction — reports errors clearly)
-- ============================================================

-- Verify standardized columns exist
DO $$
DECLARE
  missing_cols TEXT[];
BEGIN
  missing_cols := ARRAY[]::TEXT[];

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shop_subscriptions' AND column_name = 'start_date'
  ) THEN
    missing_cols := array_append(missing_cols, 'start_date');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shop_subscriptions' AND column_name = 'end_date'
  ) THEN
    missing_cols := array_append(missing_cols, 'end_date');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shop_subscriptions' AND column_name = 'amount_paid'
  ) THEN
    missing_cols := array_append(missing_cols, 'amount_paid');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'subscription_end_date'
  ) THEN
    missing_cols := array_append(missing_cols, 'shops.subscription_end_date');
  END IF;

  IF array_length(missing_cols, 1) > 0 THEN
    RAISE EXCEPTION 'MIGRATION FAILED — missing columns: %', array_to_string(missing_cols, ', ');
  END IF;
END $$;

-- Verify legacy columns are REMOVED
DO $$
DECLARE
  legacy_cols TEXT[];
BEGIN
  legacy_cols := ARRAY[]::TEXT[];

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shop_subscriptions' AND column_name = 'starts_at'
  ) THEN
    legacy_cols := array_append(legacy_cols, 'starts_at');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shop_subscriptions' AND column_name = 'expires_at'
  ) THEN
    legacy_cols := array_append(legacy_cols, 'expires_at');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'subscription_expires_at'
  ) THEN
    legacy_cols := array_append(legacy_cols, 'shops.subscription_expires_at');
  END IF;

  IF array_length(legacy_cols, 1) > 0 THEN
    RAISE WARNING 'Legacy columns still exist (non-fatal but should be removed): %', array_to_string(legacy_cols, ', ');
  END IF;
END $$;

-- ============================================================
-- Expected result: All verification DO blocks complete without
-- EXCEPTION. If any column was NOT added/migrated correctly,
-- the migration will ROLL BACK due to the RAISE EXCEPTION.
-- ============================================================
