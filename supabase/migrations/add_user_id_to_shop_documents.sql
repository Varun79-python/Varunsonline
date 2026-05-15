-- Add user_id column to shop_documents for document tracking
ALTER TABLE shop_documents ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shop_documents_user_id ON shop_documents(user_id);

-- Allow users to view their own documents
ALTER TABLE shop_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own shop documents" ON shop_documents;
CREATE POLICY "Users can view own shop documents" ON shop_documents FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own shop documents" ON shop_documents;
CREATE POLICY "Users can insert own shop documents" ON shop_documents FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own shop documents" ON shop_documents;
CREATE POLICY "Users can update own shop documents" ON shop_documents FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own shop documents" ON shop_documents;
CREATE POLICY "Users can delete own shop documents" ON shop_documents FOR DELETE 
USING (auth.uid() = user_id);

-- Admin can manage all
DROP POLICY IF EXISTS "Admins can manage shop documents" ON shop_documents;
CREATE POLICY "Admins can manage shop documents" ON shop_documents FOR ALL 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));