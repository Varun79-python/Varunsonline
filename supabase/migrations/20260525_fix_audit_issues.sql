-- ============================================================
-- FIX: Post-Audit Critical Issues
-- Applied: 2026-05-25
-- 
-- Fixes:
--   1. Add processed_by column to withdraw_requests (C4)
--   2. Fix storage RLS: remove public SELECT from doc buckets (C3)
--   3. Add wallet_balance >= 0 constraints (N recommendation)
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 1. C4: Add processed_by column to withdraw_requests
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.withdraw_requests
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES public.profiles(id);

-- ═══════════════════════════════════════════════════════════
-- 2. C3: Fix Storage RLS — Remove public SELECT from document buckets
-- Only authenticated owners and admins can view documents
-- Shop-images and product-images REMAIN public (product photos)
-- ═══════════════════════════════════════════════════════════

-- SHOP-DOCUMENTS: Remove public SELECT, restrict to owner + admin
DROP POLICY IF EXISTS "Public can view shop documents" ON storage.objects;
CREATE POLICY "Shop owners can view own documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'shop-documents' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
);

-- AGENT-DOCUMENTS: Remove public SELECT, restrict to owner + admin
DROP POLICY IF EXISTS "Public can view agent documents" ON storage.objects;
CREATE POLICY "Agents can view own documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'agent-documents' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
);

-- Shop images remain public (these are product/shop display photos)
DROP POLICY IF EXISTS "Public can view shop images" ON storage.objects;
CREATE POLICY "Public can view shop images" ON storage.objects FOR SELECT USING (bucket_id = 'shop-images');

-- Product images remain public
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

-- ═══════════════════════════════════════════════════════════
-- 3. Add wallet_balance >= 0 constraints (prevent negative wallets)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_wallet_balance_check;
ALTER TABLE public.shops
  ADD CONSTRAINT shops_wallet_balance_check
  CHECK (wallet_balance >= 0);

ALTER TABLE public.delivery_agents DROP CONSTRAINT IF EXISTS delivery_agents_wallet_balance_check;
ALTER TABLE public.delivery_agents
  ADD CONSTRAINT delivery_agents_wallet_balance_check
  CHECK (wallet_balance >= 0);

-- ═══════════════════════════════════════════════════════════
-- 4. Fix process_withdrawal function to use correct column name
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION process_withdrawal(
  p_withdrawal_id UUID, p_action TEXT, p_admin_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_request record; v_new_status TEXT;
BEGIN
  SELECT * INTO v_request FROM public.withdraw_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF v_request.status != 'pending' THEN RAISE EXCEPTION 'Withdrawal request is already %', v_request.status; END IF;
  IF p_action = 'approve' THEN v_new_status := 'approved';
  ELSIF p_action = 'reject' THEN
    v_new_status := 'rejected';
    IF v_request.user_type = 'shopkeeper' THEN
      UPDATE public.shops SET wallet_balance = COALESCE(wallet_balance, 0) + v_request.amount WHERE owner_id = v_request.user_id;
    ELSE
      UPDATE public.delivery_agents SET wallet_balance = COALESCE(wallet_balance, 0) + v_request.amount WHERE id = v_request.user_id;
    END IF;
  ELSIF p_action = 'mark_paid' THEN
    v_new_status := 'paid';
    IF v_request.user_type = 'shopkeeper' THEN
      UPDATE public.shops SET total_withdrawn = COALESCE(total_withdrawn, 0) + v_request.amount WHERE owner_id = v_request.user_id;
    ELSE
      UPDATE public.delivery_agents SET total_withdrawn = COALESCE(total_withdrawn, 0) + v_request.amount WHERE id = v_request.user_id;
    END IF;
  ELSE RAISE EXCEPTION 'Invalid action: %', p_action; END IF;
  UPDATE public.withdraw_requests
    SET status = v_new_status, processed_at = NOW(), processed_by = p_admin_id
    WHERE id = p_withdrawal_id;
  RETURN TRUE;
END;
$$;
