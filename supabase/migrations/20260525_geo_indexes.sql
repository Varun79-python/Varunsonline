-- ═══════════════════════════════════════════════════════════
-- GEO INDEXES — performance for distance-based queries
-- ═══════════════════════════════════════════════════════════

-- 1. Shops: index on latitude/longitude for customer 10km visibility
CREATE INDEX IF NOT EXISTS idx_shops_lat_lon
  ON public.shops (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 2. Delivery agents: index on last_lat/last_lon for agent 5km radius filtering
CREATE INDEX IF NOT EXISTS idx_delivery_agents_last_lat_lon
  ON public.delivery_agents (last_lat, last_lon)
  WHERE last_lat IS NOT NULL AND last_lon IS NOT NULL;

-- 3. Delivery agents: composite index for availability + GPS (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_delivery_agents_avail_lat_lon
  ON public.delivery_agents (is_available, last_lat, last_lon)
  WHERE is_available = TRUE AND last_lat IS NOT NULL AND last_lon IS NOT NULL;

-- 4. Orders: composite index for auto-assignment queries (find packed orders)
CREATE INDEX IF NOT EXISTS idx_orders_packed_unassigned
  ON public.orders (status, agent_id, placed_at)
  WHERE status = 'order_packed' AND agent_id IS NULL;

-- 5. Orders: index on agent_id + status for delivery agent's active orders
CREATE INDEX IF NOT EXISTS idx_orders_agent_status
  ON public.orders (agent_id, status)
  WHERE agent_id IS NOT NULL;

-- 6. Agent live locations: index for realtime tracking queries
CREATE INDEX IF NOT EXISTS idx_agent_live_locations_recency
  ON public.agent_live_locations (agent_id, recorded_at DESC);
