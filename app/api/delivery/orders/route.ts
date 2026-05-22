import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyDeliveryAgent } from '@/lib/authMiddleware'

export const dynamic = 'force-dynamic'

// GET — list available packed orders within 5km of agent's current location
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyDeliveryAgent(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get agent's last known GPS position
    const { data: agentRow } = await supabase
      .from('delivery_agents')
      .select('last_lat, last_lon')
      .eq('id', auth.agentId)
      .single()

    const agentLat = agentRow?.last_lat as number | null
    const agentLon = agentRow?.last_lon as number | null

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, agent_earning, total_amount,
        delivery_charge, created_at,
        shops:shop_id(name, address_line1, city, latitude, longitude),
        addresses:address_id(house_name, street_name, landmark, city, latitude, longitude)
      `)
      .eq('status', 'order_packed')
      .is('agent_id', null)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
      const R = 6371
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLon = (lon2 - lon1) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
      return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2))
    }

    const enriched = (orders || []).map((o: Record<string, unknown>) => {
      const shop = o.shops as { latitude?: number; longitude?: number } | null
      const addr = o.addresses as { latitude?: number; longitude?: number } | null
      const distShopToCustomer = (shop?.latitude && shop?.longitude && addr?.latitude && addr?.longitude)
        ? haversineKm(shop.latitude, shop.longitude, addr.latitude, addr.longitude)
        : null
      // Distance from agent to shop (for proximity filter)
      const distAgentToShop = (agentLat && agentLon && shop?.latitude && shop?.longitude)
        ? haversineKm(agentLat, agentLon, shop.latitude, shop.longitude)
        : null
      return { ...o, distShopToCustomer, distAgentToShop }
    })

    // No GPS on record — return empty list and signal the UI
    if (!agentLat || !agentLon) {
      console.log(`[Orders/API] Agent ${auth.agentId} has no GPS — returning empty order list`)
      return NextResponse.json({ orders: [], gpsRequired: true })
    }

    // Filter: only show orders whose shop is within 5km of agent
    const filtered = enriched.filter(o => o.distAgentToShop === null || o.distAgentToShop <= 5)

    return NextResponse.json({ orders: filtered })
  } catch (err) {
    console.error('Available orders error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — atomically claim an order (race-condition safe)
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyDeliveryAgent(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createServiceClient()

    // Atomic update: only succeeds if status=order_packed AND agent_id IS NULL
    // This prevents 2 agents accepting the same order
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'agent_assigned',
        agent_id: auth.agentId,
      })
      .eq('id', orderId)
      .eq('status', 'order_packed')   // guard: must still be packed
      .is('agent_id', null)            // guard: not yet claimed by anyone
      .select('id, order_number')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!data || data.length === 0) {
      // No rows updated = someone else already accepted it
      return NextResponse.json({ error: 'Order already taken by another agent', alreadyClaimed: true }, { status: 409 })
    }

    // Log status history
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: 'agent_assigned',
      changed_by: auth.agentId
    })

    return NextResponse.json({ success: true, order: data[0] })
  } catch (err) {
    console.error('Accept order error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
