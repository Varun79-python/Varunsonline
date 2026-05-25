import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyDeliveryAgent } from '@/lib/authMiddleware'
import { haversineKm } from '@/lib/gps'

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
    const hasGps = !!(agentLat && agentLon)

    // Fetch all packed unassigned orders
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

    const enriched = (orders || []).map((o: Record<string, unknown>) => {
      const shop = o.shops as { latitude?: number; longitude?: number } | null
      const addr = o.addresses as { latitude?: number; longitude?: number } | null
      const distShopToCustomer = (shop?.latitude && shop?.longitude && addr?.latitude && addr?.longitude)
        ? haversineKm(shop.latitude, shop.longitude, addr.latitude, addr.longitude)
        : null
      const distAgentToShop = (hasGps && shop?.latitude && shop?.longitude)
        ? haversineKm(agentLat!, agentLon!, shop.latitude, shop.longitude)
        : null
      return { ...o, distShopToCustomer, distAgentToShop }
    })

    // When GPS is known: filter to 5km radius. Without GPS: show all orders (don't block agent)
    const filtered = hasGps
      ? enriched.filter(o => o.distAgentToShop !== null && o.distAgentToShop <= 5)
      : enriched

    // gpsRequired signals soft UI warning (not a hard block anymore)
    return NextResponse.json({ orders: filtered, gpsRequired: !hasGps })
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
      .eq('status', 'order_packed')   // must still be packed
      .is('agent_id', null)            // not yet claimed
      .select('id, order_number')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!data || data.length === 0) {
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
