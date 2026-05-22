import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyShopkeeper } from '@/lib/authMiddleware'

export const dynamic = 'force-dynamic'

// All statuses the shopkeeper dashboard should show
const SHOP_VISIBLE_STATUSES = [
  'payment_confirmed',  // needs accept/reject decision
  'shop_accepted',      // accepted, waiting to be packed
  'order_packed',       // packed, waiting for agent
  'agent_assigned',     // agent picked up task
  'picked_up',          // agent has the order
  'out_for_delivery',   // on the way
  'delivered',          // completed
  'rejected',           // shopkeeper rejected
  'cancelled',          // customer cancelled
]

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyShopkeeper(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Fetch ALL orders for this shop (not just pending) — last 7 days + all active
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_number, status, total_amount, shopkeeper_earning, subtotal, created_at, agent_id, rejection_reason')
      .eq('shop_id', auth.shopId)
      .in('status', SHOP_VISIBLE_STATUSES)
      .or(`created_at.gte.${sevenDaysAgo},status.in.(payment_confirmed,shop_accepted,order_packed,agent_assigned,picked_up,out_for_delivery)`)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!orders || orders.length === 0) return NextResponse.json({ orders: [] })

    // Fetch all items for these orders
    const orderIds = orders.map((o: { id: string }) => o.id)
    const { data: allItems } = await supabase
      .from('order_items')
      .select('id, order_id, product_name, quantity, unit_price, total_price, product_image_url')
      .in('order_id', orderIds)

    // Fetch agent names for assigned orders
    const agentIds = orders.filter((o: { agent_id: string | null }) => o.agent_id).map((o: { agent_id: string | null }) => o.agent_id as string)
    let agentMap: Record<string, string> = {}
    if (agentIds.length > 0) {
      const { data: agents } = await supabase
        .from('delivery_agents')
        .select('id, full_name')
        .in('id', agentIds)
      agents?.forEach((a: { id: string; full_name: string }) => { agentMap[a.id] = a.full_name })
    }

    // Merge items + agent names into orders
    const merged = orders.map((o: {
      id: string; order_number: string; status: string; total_amount: number
      shopkeeper_earning: number; subtotal: number; created_at: string
      agent_id: string | null; rejection_reason?: string
    }) => ({
      ...o,
      agent_name: o.agent_id ? (agentMap[o.agent_id] || 'Assigned') : null,
      items: (allItems || []).filter((i: { order_id: string }) => i.order_id === o.id)
    }))

    return NextResponse.json({ orders: merged })
  } catch (err) {
    console.error('Pending orders fetch error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
