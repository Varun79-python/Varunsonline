-- Atomic stock decrement function
-- Prevents race conditions on concurrent order placement
-- Returns true if stock was decremented, false if insufficient stock

CREATE OR REPLACE FUNCTION decrement_stock(
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

  IF current_stock < p_quantity THEN
    RETURN FALSE;  -- Insufficient stock
  END IF;

  UPDATE products
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;

  RETURN TRUE;
END;
$$;
