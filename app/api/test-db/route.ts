import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data, error } = await supabaseAdmin.from('shop_documents').select('*').limit(1)
    
    // Also test the join
    const { data: joinData, error: joinError } = await supabaseAdmin
      .from('shop_documents')
      .select('id, profiles(full_name)')
      .limit(1)

    return NextResponse.json({ data, error, joinData, joinError })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) })
  }
}
