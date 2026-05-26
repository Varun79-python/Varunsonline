-- Atomic stock increment function (inverse of decrement_stock)
-- Used when orders are rejected or cancelled to restore product stock
-- Returns true if stock was incremented, false if product not found

CREATE OR REPLACE FUNCTION increment_stock(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  SELECT stock_quantity INTO current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;  -- Lock the row

  IF current_stock IS NULL THEN
    RETURN FALSE;  -- Product not found
  END IF;

  UPDATE products
  SET stock_quantity = stock_quantity + p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_stock TO anon;
GRANT EXECUTE ON FUNCTION increment_stock TO authenticated;
GRANT EXECUTE ON FUNCTION increment_stock TO service_role;
