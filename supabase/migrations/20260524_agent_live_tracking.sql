-- ============================================================
-- AGENT LIVE LOCATION TRACKING TABLE
-- Stores real-time GPS pings from delivery agents
-- ============================================================

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

-- Index for fast lookups by agent and time
CREATE INDEX IF NOT EXISTS idx_agent_live_locations_agent_time 
  ON public.agent_live_locations (agent_id, recorded_at DESC);

-- Index for active online agents
CREATE INDEX IF NOT EXISTS idx_agent_live_locations_online 
  ON public.agent_live_locations (agent_id, is_online) 
  WHERE is_online = TRUE;

-- Enable RLS
ALTER TABLE public.agent_live_locations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Agent can insert own location" 
  ON public.agent_live_locations FOR INSERT 
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agent can view own location" 
  ON public.agent_live_locations FOR SELECT 
  USING (agent_id = auth.uid());

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

-- Enable realtime for live tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_live_locations;

-- Add last_updated column to delivery_agents if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'delivery_agents' AND column_name = 'last_updated'
  ) THEN
    ALTER TABLE public.delivery_agents ADD COLUMN last_updated TIMESTAMPTZ;
  END IF;
END $$;
