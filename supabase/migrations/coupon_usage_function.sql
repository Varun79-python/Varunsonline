-- Add function to increment coupon usage
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_code TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.coupons
  SET used_count = used_count + 1
  WHERE code = coupon_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;