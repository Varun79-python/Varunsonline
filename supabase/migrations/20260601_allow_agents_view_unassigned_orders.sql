-- ============================================================
-- ALLOW DELIVERY AGENTS TO VIEW UNASSIGNED ORDERS FOR REALTIME
-- ============================================================

BEGIN;

-- Drop old policy if it exists
DROP POLICY IF EXISTS "Agent views unassigned orders" ON public.orders;

-- Create the new SELECT policy allowing delivery agents to view unassigned orders
CREATE POLICY "Agent views unassigned orders"
  ON public.orders
  FOR SELECT
  USING (
    agent_id IS NULL 
    AND status IN ('shop_accepted', 'order_packed')
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'delivery_agent'
    )
  );

COMMIT;
