import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Try calling increment_stock - if it doesn't exist, it throws
    const { error } = await supabase.rpc('increment_stock', {
      p_product_id: '00000000-0000-0000-0000-000000000000',
      p_quantity: 1,
    })
    
    if (error && error.message.includes('function') && error.message.includes('not found')) {
      // Function doesn't exist, create it
      // Supabase JS client doesn't support raw SQL, but we can use pg
      return NextResponse.json({ 
        exists: false, 
        message: 'Function does not exist. Run the migration SQL manually in Supabase Dashboard SQL Editor.',
        sql: \CREATE OR REPLACE FUNCTION increment_stock(p_product_id UUID, p_quantity INTEGER) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS \\\$\\\$ DECLARE current_stock INTEGER; BEGIN SELECT stock_quantity INTO current_stock FROM products WHERE id = p_product_id FOR UPDATE; IF current_stock IS NULL THEN RETURN FALSE; END IF; UPDATE products SET stock_quantity = stock_quantity + p_quantity, updated_at = NOW() WHERE id = p_product_id; RETURN TRUE; END; \\\$\\\$; GRANT EXECUTE ON FUNCTION increment_stock TO anon; GRANT EXECUTE ON FUNCTION increment_stock TO authenticated; GRANT EXECUTE ON FUNCTION increment_stock TO service_role;\
      })
    }
    
    return NextResponse.json({ exists: true, error })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
