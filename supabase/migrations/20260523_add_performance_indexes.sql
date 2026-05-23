-- ============================================================
-- Performance Indexes Migration
-- Run in: Supabase Dashboard → SQL Editor
-- Safe: all use IF NOT EXISTS — idempotent, non-breaking
-- ============================================================

-- ──────────────────────────────────────────────
-- orders table
-- Most queried table in the app (~50 query sites)
-- ──────────────────────────────────────────────

-- shop_id: used by pending-orders API on every shopkeeper load
-- Also: .eq('shop_id', ...).in('status', [...]).order('created_at')
CREATE INDEX IF NOT EXISTS idx_orders_shop_id
  ON orders (shop_id);

-- customer_id: used by customer/orders page and customer/care
-- Also the Realtime filter: filter=`customer_id=eq.${user.id}`
CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON orders (customer_id);

-- agent_id: used by active-order route on every Realtime event
-- Also: .eq('agent_id', ...).in('status', [...])
CREATE INDEX IF NOT EXISTS idx_orders_agent_id
  ON orders (agent_id);

-- Composite: shop_id + created_at — covers ORDER BY on shopkeeper list
-- Eliminates sort after filter; single index scan for both
-- .eq('shop_id', shop.id).order('created_at', { ascending: false })
CREATE INDEX IF NOT EXISTS idx_orders_shop_id_created_at
  ON orders (shop_id, created_at DESC);

-- Composite: customer_id + created_at — covers customer orders page
-- .eq('customer_id').order('created_at', { ascending: false })
CREATE INDEX IF NOT EXISTS idx_orders_customer_id_created_at
  ON orders (customer_id, created_at DESC);

-- Composite: agent_id + status — covers active-order and assignment guard
-- .eq('agent_id', ...).in('status', ['agent_assigned','picked_up','out_for_delivery'])
CREATE INDEX IF NOT EXISTS idx_orders_agent_id_status
  ON orders (agent_id, status);

-- Partial index: status = 'order_packed' with no agent
-- Directly serves delivery/orders GET (the most frequent delivery query)
-- Covers: .eq('status','order_packed').is('agent_id', null).order('created_at', DESC)
CREATE INDEX IF NOT EXISTS idx_orders_packed_unassigned
  ON orders (created_at DESC)
  WHERE status = 'order_packed' AND agent_id IS NULL;

-- razorpay_payment_id: idempotency lookup in webhook handler
-- .eq('razorpay_payment_id', razorpay_payment_id) — needs fast single-row lookup
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id
  ON orders (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- Composite: status + created_at — covers ADMIN orders page with optional status filter
-- Admin: .order('created_at', { ascending: false }).range(from, to)
-- Admin with filter: .eq('status', statusFilter).order('created_at', { ascending: false }).range(from, to)
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON orders (status, created_at DESC);

-- created_at: covers admin orders page default sort (no filter) and dashboard recent orders
-- Admin: .order('created_at', { ascending: false }).limit(25)
-- Dashboard: .order('created_at', { ascending: false }).limit(8)
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders (created_at DESC);

-- ──────────────────────────────────────────────
-- shops table
-- owner_id queried on every shopkeeper page render
-- (layout, middleware, profile, orders, wallet, products)
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_shops_owner_id
  ON shops (owner_id);

-- Composite for customer browse: .eq('is_approved',true).eq('is_active',true)
CREATE INDEX IF NOT EXISTS idx_shops_approved_active
  ON shops (is_approved, is_active)
  WHERE is_approved = true AND is_active = true;

-- ──────────────────────────────────────────────
-- shop_subscriptions table
-- shop_id + is_active: deactivate-old + insert-new pattern
-- razorpay_payment_id: webhook idempotency check
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_shop_id_active
  ON shop_subscriptions (shop_id, is_active);

-- Unique index: prevents duplicate webhook processing AND enables fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_subscriptions_razorpay_payment_id
  ON shop_subscriptions (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- For cron job: .eq('is_active',true).lt('expires_at', now)
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_active_expires
  ON shop_subscriptions (expires_at)
  WHERE is_active = true AND expires_at IS NOT NULL;

-- ──────────────────────────────────────────────
-- order_items table
-- order_id queried with .eq() on every order detail load
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items (order_id);

-- ──────────────────────────────────────────────
-- delivery_agents table
-- is_approved + is_available: agent assignment query
-- .eq('is_approved',true).eq('is_available',true)
-- (Small table, but grows with scale)
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_delivery_agents_approved_available
  ON delivery_agents (is_approved, is_available)
  WHERE is_approved = true AND is_available = true;

-- ──────────────────────────────────────────────
-- profiles table
-- role + created_at: admin customer listing
-- .eq('role', 'customer').order('created_at', { ascending: false }).range(from, to)
-- Runs on every admin dashboard page load
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_role_created_at
  ON profiles (role, created_at DESC);

-- ──────────────────────────────────────────────
-- addresses table
-- customer_id: customer address list on checkout + profile pages
-- .eq('customer_id', user.id) — runs on every checkout page load
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_addresses_customer_id
  ON addresses (customer_id);

-- ──────────────────────────────────────────────
-- products table
-- shop_id + is_available + created_at: customer shop view
-- .eq('shop_id', id).eq('is_available', true).order('created_at', { ascending: false })
-- Runs on every customer shop page visit
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_shop_id_available_created_at
  ON products (shop_id, is_available, created_at DESC);

-- shop_id + name: shopkeeper product management
-- .eq('shop_id', shopData.id).order('name')
-- Runs on every shopkeeper products page load
CREATE INDEX IF NOT EXISTS idx_products_shop_id_name
  ON products (shop_id, name);

-- ──────────────────────────────────────────────
-- coupons table
-- code: coupon validation on order placement
-- .eq('code', couponCode).single()
-- Runs on every order with coupon code
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_coupons_code
  ON coupons (code);

-- ──────────────────────────────────────────────
-- shop_documents table
-- status + created_at: admin pending documents listing
-- .eq('status', 'pending').order('created_at', { ascending: false })
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_shop_documents_status_created_at
  ON shop_documents (status, created_at DESC);

-- ──────────────────────────────────────────────
-- device_tokens table
-- user_id: push notification token lookup
-- .eq('user_id', userId)
-- Runs on every push notification send
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id
  ON device_tokens (user_id);

-- ──────────────────────────────────────────────
-- order_messages table
-- conversation_id: chat realtime subscription filter
-- Realtime filter: conversation_id=eq.{conversationId}
-- Runs on every chat open via Realtime channel
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_order_messages_conversation_id
  ON order_messages (conversation_id);

-- ============================================================
-- VERIFICATION — run this after the migration to confirm indexes
-- Paste into Supabase Dashboard → SQL Editor separately
-- ============================================================
-- SELECT
--   indexname,
--   tablename,
--   pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size,
--   indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
--
-- Expected: 25 rows covering orders, shops, shop_subscriptions,
--           order_items, delivery_agents, profiles, addresses,
--           products, coupons, shop_documents, device_tokens, order_messages
-- ============================================================

