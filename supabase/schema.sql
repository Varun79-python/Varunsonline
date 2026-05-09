-- ============================================================
-- VARUN'S ONLINE — Complete Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- for geo queries if available

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer','shopkeeper','delivery_agent','admin')),
  full_name TEXT,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLATFORM SETTINGS (admin controlled)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.platform_settings (key, value, description) VALUES
  ('shop_radius_km', '10', 'Distance radius in KM to show shops to customers'),
  ('platform_fee_percent', '5', 'Platform fee percentage charged per order'),
  ('base_delivery_charge', '30', 'Base delivery charge in INR'),
  ('per_km_delivery_charge', '5', 'Additional charge per km in INR'),
  ('min_order_amount', '50', 'Minimum order amount in INR'),
  ('max_order_amount', '5000', 'Maximum order amount in INR')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SHOPS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  landmark TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  phone TEXT,
  email TEXT,
  shop_image_url TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  is_open BOOLEAN DEFAULT TRUE,
  rejection_reason TEXT,
  upi_id TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  bank_account_name TEXT,
  wallet_balance NUMERIC(12,2) DEFAULT 0,
  total_earnings NUMERIC(12,2) DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  total_orders INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SHOP DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shop_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('aadhar_front','aadhar_back','shop_license','gst','other')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  image_url TEXT,
  mrp NUMERIC(10,2) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  unit TEXT DEFAULT 'piece',
  stock_quantity INT DEFAULT 0,
  is_available BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMER PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  default_address_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ADDRESSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Home',
  house_name TEXT NOT NULL,
  street_name TEXT NOT NULL,
  landmark TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DELIVERY AGENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_agents (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  aadhar_url TEXT,
  license_url TEXT,
  live_photo_url TEXT,
  vehicle_type TEXT,
  vehicle_number TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  rejection_reason TEXT,
  is_available BOOLEAN DEFAULT FALSE,
  upi_id TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  bank_account_name TEXT,
  wallet_balance NUMERIC(12,2) DEFAULT 0,
  total_earnings NUMERIC(12,2) DEFAULT 0,
  today_earnings NUMERIC(12,2) DEFAULT 0,
  total_deliveries INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COUPONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','flat')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order_amount NUMERIC(10,2) DEFAULT 0,
  max_discount NUMERIC(10,2),
  usage_limit INT,
  used_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  shop_id UUID REFERENCES public.shops(id), -- NULL = platform-wide
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  shop_id UUID NOT NULL REFERENCES public.shops(id),
  agent_id UUID REFERENCES public.profiles(id),
  address_id UUID NOT NULL REFERENCES public.addresses(id),
  
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN (
    'placed','payment_pending','payment_confirmed',
    'shop_accepted','order_packed','agent_assigned',
    'picked_up','out_for_delivery','delivered',
    'cancelled','rejected'
  )),
  
  -- Pricing
  subtotal NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) DEFAULT 0,
  delivery_charge NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  
  -- Earnings split
  shopkeeper_earning NUMERIC(10,2) DEFAULT 0,
  agent_earning NUMERIC(10,2) DEFAULT 0,
  admin_earning NUMERIC(10,2) DEFAULT 0,
  
  -- Coupon
  coupon_id UUID REFERENCES public.coupons(id),
  coupon_code TEXT,
  
  -- Payment
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  
  -- Notes
  customer_note TEXT,
  rejection_reason TEXT,
  
  -- Timing
  estimated_delivery_time INT, -- minutes
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  packed_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order number sequence
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'VO-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  product_image_url TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  mrp NUMERIC(10,2),
  total_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDER STATUS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','captured','failed','refunded')),
  method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WALLET TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  user_type TEXT NOT NULL CHECK (user_type IN ('shopkeeper','delivery_agent')),
  type TEXT NOT NULL CHECK (type IN ('credit','debit')),
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  order_id UUID REFERENCES public.orders(id),
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WITHDRAW REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdraw_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  user_type TEXT NOT NULL CHECK (user_type IN ('shopkeeper','delivery_agent')),
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('upi','bank_transfer','other')),
  upi_id TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  bank_account_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  admin_note TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  shop_id UUID NOT NULL REFERENCES public.shops(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdraw_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow insert on registration" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin sees all profiles" ON public.profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- SHOPS policies
CREATE POLICY "Anyone can view approved active shops" ON public.shops FOR SELECT USING (is_approved = TRUE AND is_active = TRUE);
CREATE POLICY "Shopkeeper views own shop" ON public.shops FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Shopkeeper inserts own shop" ON public.shops FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Shopkeeper updates own shop" ON public.shops FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Admin manages all shops" ON public.shops FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- PRODUCTS policies
CREATE POLICY "Anyone can view available products" ON public.products FOR SELECT USING (is_available = TRUE);
CREATE POLICY "Shopkeeper manages own products" ON public.products FOR ALL USING (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);
CREATE POLICY "Admin manages all products" ON public.products FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ORDERS policies
CREATE POLICY "Customer views own orders" ON public.orders FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Customer inserts orders" ON public.orders FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Shopkeeper views shop orders" ON public.orders FOR SELECT USING (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);
CREATE POLICY "Agent views assigned orders" ON public.orders FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Admin views all orders" ON public.orders FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ADDRESSES policies
CREATE POLICY "Customer manages own addresses" ON public.addresses FOR ALL USING (customer_id = auth.uid());

-- NOTIFICATIONS policies
CREATE POLICY "User views own notifications" ON public.notifications FOR ALL USING (user_id = auth.uid());

-- WALLET policies
CREATE POLICY "User views own wallet" ON public.wallet_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin manages wallets" ON public.wallet_transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- WITHDRAW policies
CREATE POLICY "User manages own withdrawals" ON public.withdraw_requests FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admin manages withdrawals" ON public.withdraw_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- DELIVERY AGENTS policies
CREATE POLICY "Agent views own profile" ON public.delivery_agents FOR ALL USING (id = auth.uid());
CREATE POLICY "Admin manages agents" ON public.delivery_agents FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- COUPONS policies
CREATE POLICY "Anyone can view active coupons" ON public.coupons FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admin manages coupons" ON public.coupons FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Shopkeeper manages own coupons" ON public.coupons FOR ALL USING (
  shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
);

-- PLATFORM SETTINGS policies
CREATE POLICY "Anyone can read settings" ON public.platform_settings FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admin manages settings" ON public.platform_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update shop rating on review
CREATE OR REPLACE FUNCTION update_shop_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.shops
  SET rating = (
    SELECT ROUND(AVG(rating)::NUMERIC, 2)
    FROM public.reviews
    WHERE shop_id = NEW.shop_id
  )
  WHERE id = NEW.shop_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_review_insert
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_shop_rating();

-- ============================================================
-- STORAGE BUCKETS (run separately if SQL doesn't support)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES
--   ('shop-images', 'shop-images', true),
--   ('product-images', 'product-images', true),
--   ('shop-documents', 'shop-documents', false),
--   ('agent-documents', 'agent-documents', false);

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;

-- ============================================================
-- SEED: Default admin user (update email to your email)
-- ============================================================
-- After creating your admin account via the app, run:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin-email@example.com';
