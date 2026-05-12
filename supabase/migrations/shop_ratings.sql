-- Add shop_rating column to shops table if it doesn't exist
ALTER TABLE shops ADD COLUMN IF NOT EXISTS shop_rating numeric;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS delivery_rating numeric;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS total_ratings integer DEFAULT 0;

-- Create function to update shop ratings from order_ratings
CREATE OR REPLACE FUNCTION update_shop_ratings()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update shop ratings based on average of all order ratings for that shop's orders
  UPDATE shops s
  SET 
    shop_rating = (
      SELECT ROUND(AVG(r.shop_rating)::numeric, 1)
      FROM order_ratings r
      JOIN orders o ON o.id = r.order_id
      WHERE o.shop_id = s.id AND r.shop_rating IS NOT NULL
    ),
    delivery_rating = (
      SELECT ROUND(AVG(r.delivery_rating)::numeric, 1)
      FROM order_ratings r
      JOIN orders o ON o.id = r.order_id
      WHERE o.shop_id = s.id AND r.delivery_rating IS NOT NULL
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM order_ratings r
      JOIN orders o ON o.id = r.order_id
      WHERE o.shop_id = s.id
    );
END;
$$;

-- Create trigger to automatically update shop ratings when a new rating is added
CREATE OR REPLACE FUNCTION update_shop_ratings_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM update_shop_ratings();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_ratings_update ON order_ratings;
CREATE TRIGGER shop_ratings_update
AFTER INSERT OR UPDATE OR DELETE ON order_ratings
FOR EACH STATEMENT
EXECUTE FUNCTION update_shop_ratings_trigger();

-- Run initial update
SELECT update_shop_ratings();