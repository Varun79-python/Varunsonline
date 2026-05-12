-- Create order_ratings table for customer ratings
CREATE TABLE IF NOT EXISTS order_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id),
  shop_rating INTEGER CHECK (shop_rating >= 1 AND shop_rating <= 5),
  delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, customer_id)
);

ALTER TABLE order_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ratings" ON order_ratings
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Users can insert own ratings" ON order_ratings
  FOR INSERT WITH CHECK (customer_id = auth.uid());