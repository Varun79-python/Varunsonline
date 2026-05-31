-- ============================================================
-- Additional Performance & Caching Indexes
-- Run in: Supabase Dashboard → SQL Editor
-- Safe: all use IF NOT EXISTS — idempotent, non-breaking
-- ============================================================

-- ──────────────────────────────────────────────
-- reviews table
-- .eq('shop_id', shopId).order('created_at', { ascending: false }).limit(limit)
-- Runs on every public shop page visit (via /api/reviews GET)
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reviews_shop_id_created_at
  ON public.reviews (shop_id, created_at DESC);

-- ──────────────────────────────────────────────
-- notifications table
-- .eq('user_id', userId).order('created_at', { ascending: false })
-- Runs on every role's notification page load
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read
  ON public.notifications (user_id, is_read)
  WHERE is_read = FALSE;

-- ──────────────────────────────────────────────
-- wallet_transactions table
-- .eq('user_id', userId).eq('user_type', userType).order('created_at', DESC)
-- Runs on every shopkeeper/delivery wallet page
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user
  ON public.wallet_transactions (user_id, user_type, created_at DESC);

-- ──────────────────────────────────────────────
-- withdraw_requests table
-- .eq('user_id', userId).eq('user_type', userType).order('requested_at', DESC)
-- Runs on withdrawal history pages
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_withdraw_requests_user
  ON public.withdraw_requests (user_id, user_type, requested_at DESC);

-- ──────────────────────────────────────────────
-- withdraw_requests table (admin)
-- .order('requested_at', { ascending: false })
-- Runs on admin withdrawals page
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_withdraw_requests_requested_at
  ON public.withdraw_requests (requested_at DESC);

-- ──────────────────────────────────────────────
-- products table: category-based browsing
-- .eq('is_available', true).in('category', categories)
-- Runs on customer browse page when category filter is active
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_category_available
  ON public.products (category, is_available)
  WHERE is_available = TRUE AND category IS NOT NULL;

-- ──────────────────────────────────────────────
-- Enable pg_trgm extension for ILIKE '%search%' on product names
-- Used by /api/customer/products: .or('name.ilike.%search%,description.ilike.%search%')
-- Safe: IF NOT EXISTS is idempotent
-- ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ──────────────────────────────────────────────
-- GIN trigram index on product names
-- Supports fast ILIKE '%search%' queries
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (name gin_trgm_ops);

-- ──────────────────────────────────────────────
-- orders table: payment_status queries
-- .eq('payment_status', 'paid') for analytics
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders (payment_status);

-- ──────────────────────────────────────────────
-- orders table: payment method queries
-- For COD/online payment filtering in admin
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_payment_method
  ON public.orders (payment_method);

-- ──────────────────────────────────────────────
-- order_status_history table
-- .eq('order_id', orderId).order('created_at', ASC)
-- Runs on every order detail page load
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id
  ON public.order_status_history (order_id, created_at ASC);

-- ──────────────────────────────────────────────
-- shops table: category-based customer home page
-- Customer home .eq('is_approved', true).eq('is_active', true)
-- Combined with category filtering
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shops_approved_active_category
  ON public.shops (category, is_approved, is_active)
  WHERE is_approved = TRUE AND is_active = TRUE;

-- ──────────────────────────────────────────────
-- shops table: subscription_end_date for expiry checks
-- Used in shop queries that filter expired subscriptions
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shops_subscription_end_date
  ON public.shops (subscription_end_date)
  WHERE subscription_end_date IS NOT NULL;

-- ──────────────────────────────────────────────
-- addresses table: + phone column used in delivery
-- Also covered by existing idx_addresses_customer_id
-- ──────────────────────────────────────────────

-- ──────────────────────────────────────────────
-- products table: shop_id + is_available for shop view
-- Also covered by existing idx_products_shop_id_available_created_at
-- ──────────────────────────────────────────────

-- ──────────────────────────────────────────────
-- agent_cod_settlement_ledger table
-- If it exists: .eq('agent_id'), .eq('status')
-- ──────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_cod_settlement_ledger') THEN
    CREATE INDEX IF NOT EXISTS idx_cod_settlement_agent
      ON public.agent_cod_settlement_ledger (agent_id, status);
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- shop_subscriptions table: easier lookup
-- .eq('shop_id', shopId).order('created_at', DESC)
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_shop_created
  ON public.shop_subscriptions (shop_id, created_at DESC);

-- ============================================================
-- HOTFIX: idx_orders_packed_unassigned definition conflict
-- 
-- Two prior migrations (20260523, 20260525) both defined this
-- index with the same name but different column definitions.
-- Both used IF NOT EXISTS, so only the first definition
-- (created_at DESC, less useful) took effect.
--
-- This fix replaces it with the correct composite definition
-- that covers (status, agent_id) filtering + (placed_at) sorting.
-- ============================================================
DROP INDEX IF EXISTS idx_orders_packed_unassigned;
CREATE INDEX IF NOT EXISTS idx_orders_packed_unassigned
  ON public.orders (status, agent_id, placed_at DESC)
  WHERE status = 'order_packed' AND agent_id IS NULL;

-- ============================================================
-- VERIFICATION — run after migration
-- ============================================================
-- SELECT indexname, tablename, pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
-- ============================================================
