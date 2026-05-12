import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const shopId = searchParams.get('shopId')
    if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch pending orders
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_number, status, total_amount, shopkeeper_earning, subtotal, created_at')
      .eq('shop_id', shopId)
      .eq('status', 'payment_confirmed')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!orders || orders.length === 0) return NextResponse.json({ orders: [] })

    // Fetch all items for these orders
    const orderIds = orders.map((o: { id: string }) => o.id)
    const { data: allItems } = await supabase
      .from('order_items')
      .select('id, order_id, product_name, quantity, unit_price, total_price, product_image_url')
      .in('order_id', orderIds)

    // Merge items into orders
    const merged = orders.map((o: { id: string; order_number: string; status: string; total_amount: number; shopkeeper_earning: number; subtotal: number; created_at: string }) => ({
      ...o,
      items: (allItems || []).filter((i: { order_id: string }) => i.order_id === o.id)
    }))

    return NextResponse.json({ orders: merged })
  } catch (err) {
    console.error('Pending orders fetch error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
