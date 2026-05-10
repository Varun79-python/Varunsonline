import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

    // Service role bypasses RLS — shopkeeper can read order + items
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const [{ data: order, error: ordErr }, { data: items }] = await Promise.all([
      supabase.from('orders').select('*, addresses(*)').eq('id', orderId).single(),
      supabase.from('order_items').select('*').eq('order_id', orderId)
    ])

    if (ordErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    return NextResponse.json({ order, items: items || [] })
  } catch (err) {
    console.error('Order detail fetch error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
