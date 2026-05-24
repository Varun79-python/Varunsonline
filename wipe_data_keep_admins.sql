-- ============================================================
-- WIPE ALL DATA — KEEP ONLY ADMIN PROFILES & PLATFORM SETTINGS
-- Run this in Supabase Dashboard → SQL Editor
-- Safe order: child tables first → parent tables last
-- ============================================================

BEGIN;

-- ============================================================
-- 1. LEAF TABLES (no remaining children, no critical FKs)
-- ============================================================
DELETE FROM public.order_messages;
DELETE FROM public.product_ratings;
DELETE FROM public.order_ratings;
DELETE FROM public.customer_complaints;
DELETE FROM public.wallet_transactions;
DELETE FROM public.device_tokens;
DELETE FROM public.rate_limits;

-- ============================================================
-- 2. TABLES DEPENDENT ON orders (without CASCADE from orders)
-- ============================================================
DELETE FROM public.reviews;
DELETE FROM public.payments;

-- ============================================================
-- 3. TABLES WITH CASCADE FROM orders (safe either way)
-- ============================================================
DELETE FROM public.order_status_history;
DELETE FROM public.order_items;
DELETE FROM public.order_conversations;

-- ============================================================
-- 4. ORDERS — must delete BEFORE profiles/addresses/shops
--    (orders references profiles, addresses, shops WITHOUT CASCADE)
-- ============================================================
DELETE FROM public.orders;

-- ============================================================
-- 5. TABLES THAT REFERENCE profiles WITHOUT CASCADE
-- ============================================================
DELETE FROM public.withdraw_requests;
DELETE FROM public.notifications;
DELETE FROM public.coupons;

-- ============================================================
-- 6. TABLES WITH CASCADE FROM profiles
--    (explicit delete for safety; also handles shop/document chains)
-- ============================================================
DELETE FROM public.agent_live_locations;
DELETE FROM public.addresses;
DELETE FROM public.shop_subscriptions;
DELETE FROM public.shop_documents;
DELETE FROM public.products;
DELETE FROM public.shops;
DELETE FROM public.customers;
DELETE FROM public.delivery_agents;

-- ============================================================
-- 7. DELETE NON-ADMIN PROFILES ONLY
--    This cascade-deletes any remaining rows in:
--      shops → products, shop_documents, shop_subscriptions
--      customers, addresses, delivery_agents, agent_live_locations
-- ============================================================
DELETE FROM public.profiles WHERE role != 'admin';

-- ============================================================
-- 8. RESET AUTO-INCREMENT SEQUENCES
-- ============================================================
ALTER SEQUENCE IF EXISTS public.order_number_seq RESTART WITH 1;

-- ============================================================
-- 9. VERIFICATION
-- ============================================================
DO $$
DECLARE
  v_admin_count INT;
  v_other_count INT;
BEGIN
  SELECT COUNT(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin';
  SELECT COUNT(*) INTO v_other_count FROM public.profiles WHERE role != 'admin';

  RAISE NOTICE '✔ Admin profiles preserved: %', v_admin_count;
  RAISE NOTICE '✔ Non-admin profiles deleted (should be 0): %', v_other_count;

  IF v_admin_count = 0 THEN
    RAISE WARNING '⚠ No admin profiles found! Did you create an admin user first?';
  END IF;
END $$;

-- Quick row-count sanity checks
SELECT 'orders' AS table_name, COUNT(*) AS remaining_rows FROM public.orders
UNION ALL
SELECT 'shops', COUNT(*) FROM public.shops
UNION ALL
SELECT 'products', COUNT(*) FROM public.products
UNION ALL
SELECT 'addresses', COUNT(*) FROM public.addresses
UNION ALL
SELECT 'delivery_agents', COUNT(*) FROM public.delivery_agents
UNION ALL
SELECT 'customers', COUNT(*) FROM public.customers;

COMMIT;
