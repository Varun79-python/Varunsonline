-- ============================================================
-- SEED DATA: Test Accounts & Initial Data
-- Run this in Supabase SQL Editor AFTER schema.sql
-- 
-- Usage:
--   1. First create users via the app's signup pages
--   2. Then run: UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@test.com';
--   3. Or use SQL below to create users via Supabase Auth API (requires admin key)
--
-- NOTE: Supabase Auth users cannot be created via raw SQL directly.
-- Use the Supabase Auth Admin API or Management API to create users.
-- This file provides the SQL for AFTER user creation.
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 1. PLATFORM SETTINGS (idempotent)
-- ═══════════════════════════════════════════════════════════
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('shop_radius_km', '10', 'Distance radius in KM to show shops to customers'),
  ('platform_fee_percent', '5', 'Platform fee percentage charged per order'),
  ('base_delivery_charge', '30', 'Base delivery charge in INR'),
  ('per_km_delivery_charge', '5', 'Additional charge per km in INR'),
  ('min_order_amount', '50', 'Minimum order amount in INR'),
  ('max_order_amount', '5000', 'Maximum order amount in INR')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 2. SUBSCRIPTION PLANS (idempotent)
-- ═══════════════════════════════════════════════════════════
INSERT INTO public.subscription_plans (id, name, description, plan_type, fee_percent, monthly_fee, duration_days, price, commission_percent, features, is_active) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Basic Percentage', 'Pay-as-you-go — small commission per order', 'percentage', 5, 0, 30, NULL, 5, '{"listings": 100, "support": "email"}', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'Standard Monthly', 'Most popular — fixed monthly fee', 'fixed_monthly', 3, 999, 30, 999, 3, '{"listings": 500, "support": "priority", "analytics": true}', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'Premium Monthly', 'For established businesses — lowest commission', 'fixed_monthly', 2, 1999, 30, 1999, 2, '{"listings": -1, "support": "phone", "analytics": true, "featured": true}', true)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 3. TEST USER SETUP INSTRUCTIONS
-- ═══════════════════════════════════════════════════════════
-- 
-- STEP 1: Create users via Supabase Auth (use Dashboard → Authentication → Add User)
--         OR via signup from the app.
--
-- Test accounts to create:
--   a) Admin: venkatavarun79@gmail.com (already exists)
--   b) Shopkeeper: shopkeeper@test.com → password: test@123
--   c) Delivery Agent: agent@test.com → password: test@123  
--   d) Customer: customer@test.com → password: test@123
--
-- STEP 2: After creating each user, manually set the role via SQL:
--   UPDATE public.profiles SET role = 'admin' WHERE email = 'venkatavarun79@gmail.com';
--   UPDATE public.profiles SET role = 'shopkeeper' WHERE email = 'shopkeeper@test.com';
--   UPDATE public.profiles SET role = 'delivery_agent' WHERE email = 'agent@test.com';
--   UPDATE public.profiles SET role = 'customer' WHERE email = 'customer@test.com';
--
-- STEP 3 (Optional): Populate delivery_agents, shops, customers tables:

-- For the test shopkeeper (replace user_id with actual UUID from auth.users):
-- INSERT INTO public.shops (id, owner_id, name, description, category, address_line1, city, latitude, longitude, phone, is_approved, is_active, is_open, wallet_balance)
-- VALUES (
--   uuid_generate_v4(),
--   '<shopkeeper_user_id>',
--   'Test Grocery Store',
--   'Fresh groceries and daily essentials',
--   'Grocery',
--   '123 Main Road',
--   'Hyderabad',
--   17.3850, 78.4867,
--   '9999999991',
--   true, true, true,
--   0
-- );

-- For the test delivery agent (replace user_id with actual UUID):
-- INSERT INTO public.delivery_agents (id, full_name, email, phone, vehicle_type, vehicle_number, gender, is_approved, is_active, is_available, wallet_balance)
-- VALUES (
--   '<agent_user_id>',
--   'Test Delivery Agent',
--   'agent@test.com',
--   '9999999992',
--   'Bike',
--   'TS 01 AB 1234',
--   'male',
--   true, true, true,
--   0
-- );

-- ═══════════════════════════════════════════════════════════
-- 4. VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════
SELECT '✅ Platform settings:' AS status;
SELECT key, value FROM public.platform_settings ORDER BY key;

SELECT '✅ Subscription plans:' AS status;
SELECT name, plan_type, price, fee_percent, is_active FROM public.subscription_plans ORDER BY name;
