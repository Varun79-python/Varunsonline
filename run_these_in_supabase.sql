-- ============================================================
-- RUN THIS entire file in Supabase Dashboard → SQL Editor
-- These are the missing migrations needed for production
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 1. FIX rate_limits table + create increment_rate_limit function
-- ═══════════════════════════════════════════════════════════
-- First drop the old table if it has wrong schema
DROP TABLE IF EXISTS rate_limits CASCADE;

CREATE TABLE rate_limits (
  identifier TEXT NOT NULL,
  endpoint   TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identifier, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start
  ON rate_limits (window_start);

ALTER TABLE rate_limits DISABLE ROW LEVEL SECURITY;

-- Atomic increment function
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_identifier TEXT,
  p_endpoint   TEXT,
  p_window_ms  INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count      INTEGER;
  v_window_start TIMESTAMPTZ;
  v_now        TIMESTAMPTZ := NOW();
  v_window_duration INTERVAL := (p_window_ms || ' milliseconds')::INTERVAL;
BEGIN
  INSERT INTO rate_limits (identifier, endpoint, count, window_start)
  VALUES (p_identifier, p_endpoint, 1, v_now)
  ON CONFLICT (identifier, endpoint) DO UPDATE
    SET
      count = CASE
        WHEN rate_limits.window_start + v_window_duration < v_now THEN 1
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start + v_window_duration < v_now THEN v_now
        ELSE rate_limits.window_start
      END
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

-- Cleanup function (optional)
CREATE OR REPLACE FUNCTION cleanup_rate_limits(p_older_than_hours INTEGER DEFAULT 2)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < NOW() - (p_older_than_hours || ' hours')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 2. CREATE agent_live_locations table
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.agent_live_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  is_online BOOLEAN DEFAULT TRUE,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_live_locations_agent_time 
  ON public.agent_live_locations (agent_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_live_locations_online 
  ON public.agent_live_locations (agent_id, is_online) 
  WHERE is_online = TRUE;

ALTER TABLE public.agent_live_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agent can insert own location" ON public.agent_live_locations;
CREATE POLICY "Agent can insert own location" 
  ON public.agent_live_locations FOR INSERT 
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS "Agent can view own location" ON public.agent_live_locations;
CREATE POLICY "Agent can view own location" 
  ON public.agent_live_locations FOR SELECT 
  USING (agent_id = auth.uid());

DROP POLICY IF EXISTS "Order participants can view agent location" ON public.agent_live_locations;
CREATE POLICY "Order participants can view agent location" 
  ON public.agent_live_locations FOR SELECT 
  USING (
    agent_id IN (
      SELECT agent_id FROM public.orders 
      WHERE agent_id IS NOT NULL
        AND (
          customer_id = auth.uid()
          OR agent_id = auth.uid()
          OR shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'agent_live_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_live_locations;
  END IF;
END;
$$;

-- Add last_updated to delivery_agents
ALTER TABLE public.delivery_agents ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════
-- 3. RECONCILE subscription_plans — add missing columns
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';

-- Relax plan_type check constraint to accept all types
ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_plan_type_check;
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_plan_type_check
  CHECK (plan_type IN ('percentage','fixed_monthly','monthly','quarterly','half_yearly','yearly'));

-- Make price nullable (percentage plans have no fixed price)
ALTER TABLE public.subscription_plans ALTER COLUMN price DROP NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- 4. SEED default subscription plans (if empty)
-- ═══════════════════════════════════════════════════════════
INSERT INTO public.subscription_plans (id, name, description, plan_type, fee_percent, monthly_fee, duration_days, price, commission_percent, features, is_active)
SELECT uuid_generate_v4(), 'Basic Percentage', 'Pay-as-you-go — small commission per order', 'percentage', 5, 0, 30, NULL, 5, '{"listings": 100, "support": "email"}', true
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE plan_type = 'percentage' LIMIT 1);

INSERT INTO public.subscription_plans (id, name, description, plan_type, fee_percent, monthly_fee, duration_days, price, commission_percent, features, is_active)
SELECT uuid_generate_v4(), 'Standard Monthly', 'Most popular — fixed monthly fee', 'fixed_monthly', 3, 999, 30, 999, 3, '{"listings": 500, "support": "priority", "analytics": true}', true
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE plan_type = 'fixed_monthly' AND monthly_fee = 999 LIMIT 1);

INSERT INTO public.subscription_plans (id, name, description, plan_type, fee_percent, monthly_fee, duration_days, price, commission_percent, features, is_active)
SELECT uuid_generate_v4(), 'Premium Monthly', 'For established businesses — lowest commission', 'fixed_monthly', 2, 1999, 30, 1999, 2, '{"listings": -1, "support": "phone", "analytics": true, "featured": true}', true
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE plan_type = 'fixed_monthly' AND monthly_fee = 1999 LIMIT 1);

-- ═══════════════════════════════════════════════════════════
-- 5. ADD MISSING DELIVERY AGENT GPS COLUMNS (CRITICAL — autoAssignAgent will crash without these)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.delivery_agents ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION;
ALTER TABLE public.delivery_agents ADD COLUMN IF NOT EXISTS last_lon DOUBLE PRECISION;

-- ═══════════════════════════════════════════════════════════
-- 6. CREATE decrement_product_stock FUNCTION (CRITICAL — stock won't be deducted without this)
-- ═══════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.decrement_product_stock(UUID, INT);
CREATE OR REPLACE FUNCTION public.decrement_product_stock(product_id_param UUID, quantity_param INT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = GREATEST(0, stock_quantity - quantity_param),
      is_available = CASE WHEN stock_quantity - quantity_param <= 0 THEN FALSE ELSE is_available END,
      updated_at = NOW()
  WHERE id = product_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════
-- 7. CREATE increment_coupon_usage FUNCTION (needed when coupons are used)
-- ═══════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.increment_coupon_usage(TEXT);
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_code_param TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.coupons
  SET used_count = used_count + 1
  WHERE code = coupon_code_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════
-- 8. ADD PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_agent_id ON public.orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON public.orders(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_shop_id ON public.products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON public.products(is_available);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_shop_id ON public.shop_subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_end_date ON public.shop_subscriptions(end_date);

-- ═══════════════════════════════════════════════════════════
-- 9a. GEO INDEXES for distance queries
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_shops_lat_lon
  ON public.shops (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_agents_last_lat_lon
  ON public.delivery_agents (last_lat, last_lon)
  WHERE last_lat IS NOT NULL AND last_lon IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_agents_avail_lat_lon
  ON public.delivery_agents (is_available, last_lat, last_lon)
  WHERE is_available = TRUE AND last_lat IS NOT NULL AND last_lon IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_packed_unassigned
  ON public.orders (status, agent_id, placed_at)
  WHERE status = 'order_packed' AND agent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_agent_status
  ON public.orders (agent_id, status)
  WHERE agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_live_locations_recency
  ON public.agent_live_locations (agent_id, recorded_at DESC);

-- ═══════════════════════════════════════════════════════════
-- 10. VERIFY everything works
-- ═══════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════
SELECT '✅ increment_rate_limit function:' AS test, increment_rate_limit('test', 'verify', 60000) AS result;
SELECT '✅ rate_limits table:' AS test, COUNT(*) FROM rate_limits;
SELECT '✅ agent_live_locations table:' AS test, COUNT(*) FROM agent_live_locations;
SELECT '✅ subscription_plans columns:' AS test, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscription_plans' ORDER BY ordinal_position;
