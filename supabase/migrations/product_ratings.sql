-- Add rating columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_ratings integer DEFAULT 0;

-- Create product_ratings table for individual product ratings
CREATE TABLE IF NOT EXISTS product_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, product_id, customer_id)
);

ALTER TABLE product_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product ratings" ON product_ratings
  FOR SELECT USING (true);

CREATE POLICY "Customers can insert own ratings" ON product_ratings
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update own ratings" ON product_ratings
  FOR UPDATE USING (customer_id = auth.uid());

-- Function to update product ratings
CREATE OR REPLACE FUNCTION update_product_ratings()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products p
  SET 
    rating = (
      SELECT ROUND(AVG(r.rating)::numeric, 1)
      FROM product_ratings r
      WHERE r.product_id = p.id AND r.rating IS NOT NULL
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM product_ratings r
      WHERE r.product_id = p.id
    );
END;
$$;

-- Trigger to auto-update product ratings
CREATE OR REPLACE FUNCTION update_product_ratings_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM update_product_ratings();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_ratings_update ON product_ratings;
CREATE TRIGGER product_ratings_update
AFTER INSERT OR UPDATE OR DELETE ON product_ratings
FOR EACH STATEMENT
EXECUTE FUNCTION update_product_ratings_trigger();

-- Run initial calculation
SELECT update_product_ratings();