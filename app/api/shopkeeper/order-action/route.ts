import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushToUser } from '@/lib/pushHelper'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Attempt to auto-assign the best available delivery agent to the order. */
async function autoAssignAgent(orderId: string): Promise<{ agentId?: string; agentName?: string; error?: string }> {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: agents } = await supabase
      .from('delivery_agents')
      .select('id, full_name, total_deliveries, last_lat, last_lon')
      .eq('is_approved', true)
      .eq('is_available', true)
      .is('current_order_id', null)

    if (!agents || agents.length === 0) return { error: 'no_agents' }

    const { data: ord } = await supabase
      .from('orders')
      .select('shops:shop_id(latitude, longitude)')
      .eq('id', orderId)
      .single()

    const shopLat = (ord?.shops as unknown as { latitude: number; longitude: number } | null)?.latitude ?? null
    const shopLon = (ord?.shops as unknown as { latitude: number; longitude: number } | null)?.longitude ?? null

    function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
      const R = 6371
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLon = (lon2 - lon1) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    type Agent = { id: string; full_name: string; total_deliveries: number; last_lat: number | null; last_lon: number | null }

    const best = (agents as Agent[])
      .map(a => {
        const dist = (shopLat && shopLon && a.last_lat && a.last_lon)
          ? haversineKm(a.last_lat, a.last_lon, shopLat, shopLon) : 9999
        return { ...a, score: dist * 1000 + (a.total_deliveries || 0) }
      })
      .sort((a, b) => a.score - b.score)[0]

    const { data: updated } = await supabase
      .from('orders')
      .update({ agent_id: best.id, status: 'agent_assigned' })
      .eq('id', orderId)
      .is('agent_id', null)
      .select('id, order_number')

    if (!updated || updated.length === 0) return { error: 'race_condition' }

    await supabase.from('order_status_history').insert({
      order_id: orderId, status: 'agent_assigned', changed_by: best.id
    })

    return { agentId: best.id, agentName: best.full_name }
  } catch (e) {
    console.error('autoAssignAgent error:', e)
    return { error: 'exception' }
  }
}

/**
 * Send FCM push to the newly assigned delivery agent.
 * The agent's Supabase user_id IS their delivery_agents.id.
 */
async function notifyAgent(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
  orderId: string,
  orderNumber: string,
  shopName: string,
  customerCity: string
): Promise<void> {
  await pushToUser(
    supabase,
    agentId,
    '🛵 New Delivery Assigned!',
    `Order ${orderNumber} — Pick up from ${shopName}, deliver to ${customerCity}. Tap to view.`,
    {
      type: 'agent_assigned',
      role: 'delivery_agent',
      orderId,
      orderNumber,
    },
    'varunsonline_orders'
  )
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, action, reason } = await req.json()
    if (!orderId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: order } = await supabase
      .from('orders')
      .select('id, status, shop_id')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const now = new Date().toISOString()
    let updateData: Record<string, string> = {}

    if (action === 'accept') {
      if (order.status !== 'payment_confirmed')
        return NextResponse.json({ error: 'Order already processed', currentStatus: order.status }, { status: 409 })
      const otp = Math.floor(1000 + Math.random() * 9000).toString()
      updateData = { status: 'shop_accepted', accepted_at: now, delivery_otp: otp }

    } else if (action === 'reject') {
      if (order.status !== 'payment_confirmed')
        return NextResponse.json({ error: 'Order already processed', currentStatus: order.status }, { status: 409 })
      updateData = { status: 'rejected', rejection_reason: reason || '' }

    } else if (action === 'pack') {
      if (order.status !== 'shop_accepted')
        return NextResponse.json({ error: 'Order must be accepted before packing', currentStatus: order.status }, { status: 409 })
      updateData = { status: 'order_packed', packed_at: now }

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (updateError) {
      console.error('Order update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: updateData.status
    })

    // ── Auto-assign delivery agent on accept ───────────────────────────────
    let assignResult: { agentId?: string; agentName?: string; error?: string } = {}
    if (action === 'accept') {
      await supabase.from('orders').update({ status: 'order_packed', packed_at: now }).eq('id', orderId)
      await supabase.from('order_status_history').insert({ order_id: orderId, status: 'order_packed' })
      assignResult = await autoAssignAgent(orderId)

      // ── Send FCM push to assigned agent ──────────────────────────────────
      if (assignResult.agentId) {
        // Fetch order details for the notification body
        const { data: orderDetails } = await supabase
          .from('orders')
          .select('order_number, shops:shop_id(name), addresses:address_id(city)')
          .eq('id', orderId)
          .single()

        const shopName = (orderDetails?.shops as { name: string } | null)?.name || 'the shop'
        const city = (orderDetails?.addresses as { city: string } | null)?.city || 'customer'
        const orderNum = orderDetails?.order_number || orderId.slice(0, 8).toUpperCase()

        // Fire-and-forget — push failure must NOT break the order flow
        notifyAgent(supabase, assignResult.agentId, orderId, orderNum, shopName, city).catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      newStatus: updateData.status,
      agentAssigned: !!assignResult.agentId,
      agentId: assignResult.agentId,
      agentName: assignResult.agentName,
      agentError: assignResult.error
    })
  } catch (err) {
    console.error('Order action error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
