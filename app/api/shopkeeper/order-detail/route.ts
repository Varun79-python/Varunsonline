import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyShopkeeper } from '@/lib/authMiddleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyShopkeeper(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

    const supabase = createServiceClient()

    const [{ data: order, error: ordErr }, { data: items }] = await Promise.all([
      supabase.from('orders').select('*, addresses(*)').eq('id', orderId).single(),
      supabase.from('order_items').select('*').eq('order_id', orderId)
    ])

    if (ordErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Verify shop owns this order
    if (order.shop_id !== auth.shopId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    return NextResponse.json({ order, items: items || [] })
  } catch (err) {
    console.error('Order detail fetch error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
