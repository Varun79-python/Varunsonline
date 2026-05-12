CREATE TABLE IF NOT EXISTS customer_complaints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES profiles(id),
  order_id UUID REFERENCES orders(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  complaint_type TEXT NOT NULL CHECK (complaint_type IN ('order', 'delivery', 'product', 'payment', 'shop', 'other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'rejected')),
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own complaints" ON customer_complaints
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can create complaints" ON customer_complaints
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Admins can view all complaints" ON customer_complaints
  FOR SELECT USING (true);

CREATE POLICY "Admins can update complaints" ON customer_complaints
  FOR UPDATE USING (true);