import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyShopkeeper } from '@/lib/authMiddleware'
import { pushToUser } from '@/lib/pushHelper'
import { type SupabaseClient } from '@supabase/supabase-js'
import { haversineKm } from '@/lib/gps'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Attempt to auto-assign the best available delivery agent to the order. */
async function autoAssignAgent(orderId: string): Promise<{ agentId?: string; agentName?: string; error?: string }> {
  try {
    const supabase = createServiceClient()

    // Find agents who already have an active order — exclude them
    const { data: busyAgentRows } = await supabase
      .from('orders')
      .select('agent_id')
      .in('status', ['agent_assigned', 'picked_up', 'out_for_delivery'])
      .not('agent_id', 'is', null)

    const busyIds: string[] = (busyAgentRows || [])
      .map((r: { agent_id: string | null }) => r.agent_id)
      .filter(Boolean) as string[]

    let query = supabase
      .from('delivery_agents')
      .select('id, full_name, total_deliveries, last_lat, last_lon')
      .eq('is_approved', true)
      .eq('is_available', true)

    if (busyIds.length > 0) {
      query = query.not('id', 'in', `(${busyIds.join(',')})`)
    }

    const { data: agents } = await query
    if (!agents || agents.length === 0) return { error: 'no_agents' }

    // Get shop GPS coordinates for distance calculation
    const { data: ord } = await supabase
      .from('orders')
      .select('shops:shop_id(latitude, longitude)')
      .eq('id', orderId)
      .single()

    const shopLat = (ord?.shops as unknown as { latitude: number; longitude: number } | null)?.latitude ?? null
    const shopLon = (ord?.shops as unknown as { latitude: number; longitude: number } | null)?.longitude ?? null

    type Agent = { id: string; full_name: string; total_deliveries: number; last_lat?: number | null; last_lon?: number | null }

    // Filter agents by 5km radius from shop (strict delivery radius)
    let eligibleAgents = agents as Agent[]
    if (shopLat != null && shopLon != null) {
      eligibleAgents = (agents as Agent[]).filter(a => {
        if (a.last_lat == null || a.last_lon == null) return false // skip agents without GPS
        const dist = haversineKm(shopLat, shopLon, a.last_lat, a.last_lon)
        return dist <= 5 // strict 5km radius
      })
    }
    // If no agents within 5km (or shop has no GPS), fall back to any available agent
    if (eligibleAgents.length === 0) {
      eligibleAgents = agents as Agent[]
    }

    if (eligibleAgents.length === 0) return { error: 'no_agents' }

    // Score: prefer agents with more deliveries (experience), then nearest
    const best = (eligibleAgents as Agent[])
      .sort((a, b) => {
        const deliveriesDiff = (b.total_deliveries || 0) - (a.total_deliveries || 0)
        if (deliveriesDiff !== 0) return deliveriesDiff
        // If tied on deliveries, prefer the agent nearer to the shop
        if (shopLat != null && shopLon != null && a.last_lat != null && a.last_lon != null && b.last_lat != null && b.last_lon != null) {
          const distA = haversineKm(shopLat, shopLon, a.last_lat, a.last_lon)
          const distB = haversineKm(shopLat, shopLon, b.last_lat, b.last_lon)
          return distA - distB
        }
        return 0
      })
      [0]

    // Final race-condition check — verify agent still idle
    const { data: agentBusy } = await supabase
      .from('orders')
      .select('id')
      .eq('agent_id', best.id)
      .in('status', ['agent_assigned', 'picked_up', 'out_for_delivery'])
      .maybeSingle()

    if (agentBusy) return { error: 'race_condition' }

    // Atomic assignment: only succeeds if agent_id IS NULL (prevents double-assignment)
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
  supabase: SupabaseClient,
  agentId: string,
  orderId: string,
  orderNumber: string,
  shopName: string,
  customerCity: string,
  distAgentToShop: number | null,
  distShopToCustomer: number | null
): Promise<void> {
  const distPart = [
    distAgentToShop !== null ? `📍 You → Shop: ${distAgentToShop < 1 ? `${Math.round(distAgentToShop * 1000)}m` : `${distAgentToShop.toFixed(1)}km`}` : null,
    distShopToCustomer !== null ? `🏠 Shop → Customer: ${distShopToCustomer < 1 ? `${Math.round(distShopToCustomer * 1000)}m` : `${distShopToCustomer.toFixed(1)}km`}` : null,
  ].filter(Boolean).join(' · ')

  await pushToUser(
    supabase,
    agentId,
    '🛵 New Delivery Assigned!',
    `Order ${orderNumber} — Pick up from ${shopName}, deliver to ${customerCity}. ${distPart}`,
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
    // Rate limit: 20 order actions per minute
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = await checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 20,
      message: 'Too many order actions. Please slow down.',
    })
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const auth = await verifyShopkeeper(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { orderId, action, reason } = await req.json()
    if (!orderId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createServiceClient()

    const { data: order } = await supabase
      .from('orders')
      .select('id, status, shop_id')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Verify shop owns this order
    if (order.shop_id !== auth.shopId) {
      return NextResponse.json({ error: 'Not authorized to manage this order' }, { status: 403 })
    }

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
          .select('order_number, shops:shop_id(name, latitude, longitude), addresses:address_id(city, latitude, longitude)')
          .eq('id', orderId)
          .single()

        const shopName = (orderDetails?.shops as unknown as { name: string } | null)?.name || 'the shop'
        const city = (orderDetails?.addresses as unknown as { city: string } | null)?.city || 'customer'
        const orderNum = orderDetails?.order_number || orderId.slice(0, 8).toUpperCase()

        // Compute distances for the push notification
        const shopLat2 = (orderDetails?.shops as unknown as { latitude: number; longitude: number } | null)?.latitude ?? null
        const shopLon2 = (orderDetails?.shops as unknown as { latitude: number; longitude: number } | null)?.longitude ?? null
        const custLat = (orderDetails?.addresses as unknown as { latitude: number; longitude: number } | null)?.latitude ?? null
        const custLon = (orderDetails?.addresses as unknown as { latitude: number; longitude: number } | null)?.longitude ?? null

        // Agent GPS is stored in agent_live_locations table (most recent)
        const { data: agentGps } = await supabase
          .from('agent_live_locations')
          .select('latitude, longitude')
          .eq('agent_id', assignResult.agentId)
          .eq('is_online', true)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const distAgentToShop = (agentGps?.latitude && agentGps?.longitude && shopLat2 && shopLon2)
          ? haversineKm(agentGps.latitude, agentGps.longitude, shopLat2, shopLon2) : null
        const distShopToCustomer = (shopLat2 && shopLon2 && custLat && custLon)
          ? haversineKm(shopLat2, shopLon2, custLat, custLon) : null

        notifyAgent(supabase, assignResult.agentId, orderId, orderNum, shopName, city, distAgentToShop, distShopToCustomer).catch(() => {})
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
