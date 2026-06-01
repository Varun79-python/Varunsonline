import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyDeliveryAgent, validateOrigin } from '@/lib/authMiddleware'
import { haversineKm } from '@/lib/gps'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const MAX_ACTIVE_ORDERS = 1 // max concurrent deliveries per agent
const RADIUS_KM = 5          // delivery radius from agent to shop (km)
const GPS_FRESHNESS_MS = 15 * 60 * 1000 // 15 minutes — GPS must be newer than this

// GET — list available unassigned orders within radius of agent's current location
export async function GET(req: NextRequest) {
  try {
    // ── CSRF is not needed for GET (idempotent), but rate limit ─
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = await checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 60,
      endpoint: 'delivery-orders-list',
      message: 'Too many requests.',
    })
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const auth = await verifyDeliveryAgent(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const supabase = createServiceClient()
    const now = new Date()

    // ── Eligibility + GPS freshness checks ──────────────────────
    const { data: agentRow } = await supabase
      .from('delivery_agents')
      .select('is_approved, is_available, is_suspended, is_blocked, last_lat, last_lon, last_updated')
      .eq('id', auth.agentId)
      .single()

    if (!agentRow) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    if (!agentRow.is_approved) {
      return NextResponse.json({ error: 'Agent not approved' }, { status: 403 })
    }
    if (agentRow.is_blocked || agentRow.is_suspended) {
      return NextResponse.json({ orders: [], blocked: true })
    }
    if (!agentRow.is_available) {
      // Offline agents see no orders
      return NextResponse.json({ orders: [] })
    }

    const agentLat = agentRow.last_lat as number | null
    const agentLon = agentRow.last_lon as number | null
    const lastUpdated = agentRow.last_updated as string | null
    const hasGps = !!(agentLat && agentLon)

    if (!hasGps) {
      // No GPS = no orders (strict — agent must have location to receive work)
      return NextResponse.json({ orders: [], gpsRequired: true })
    }

    // GPS freshness check — warn if too old (but still return orders, guided by client)
    let gpsIsFresh = false
    if (lastUpdated) {
      const gpsAge = now.getTime() - new Date(lastUpdated).getTime()
      gpsIsFresh = gpsAge <= GPS_FRESHNESS_MS
    }
    const gpsStale = !gpsIsFresh


    // ── Active order limit check ────────────────────────────────────
    const { count: activeCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', auth.agentId)
      .in('status', ['agent_assigned', 'picked_up', 'out_for_delivery'])

    if (activeCount != null && activeCount >= MAX_ACTIVE_ORDERS) {
      return NextResponse.json({ orders: [], atCapacity: true, maxActive: MAX_ACTIVE_ORDERS })
    }

    // ── Fetch available unassigned orders ───────────────────────────
    // Show both shop_accepted (Preparing) and order_packed (Ready For Pickup)
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, agent_earning, total_amount,
        delivery_charge, created_at,
        shops:shop_id(name, address_line1, city, latitude, longitude),
        addresses:address_id(house_name, street_name, landmark, city, latitude, longitude)
      `)
      .in('status', ['shop_accepted', 'order_packed'])
      .is('agent_id', null)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ── Enrich with distances and phase ─────────────────────────────
    const enriched = (orders || []).map((o: Record<string, unknown>) => {
      const shop = o.shops as { latitude?: number; longitude?: number } | null
      const addr = o.addresses as { latitude?: number; longitude?: number } | null
      const distShopToCustomer = (shop?.latitude && shop?.longitude && addr?.latitude && addr?.longitude)
        ? haversineKm(shop.latitude, shop.longitude, addr.latitude, addr.longitude)
        : null
      const distAgentToShop = (hasGps && shop?.latitude && shop?.longitude)
        ? haversineKm(agentLat!, agentLon!, shop.latitude, shop.longitude)
        : null

      // Phase: "Preparing" for shop_accepted, "Ready For Pickup" for order_packed
      const phase = o.status === 'shop_accepted' ? 'Preparing' : 'Ready For Pickup'

      return { ...o, distShopToCustomer, distAgentToShop, phase }
    })

    // ── Radius filter (strict) ──────────────────────────────────────
    const filtered = enriched.filter(
      (o: { distAgentToShop: number | null }) => o.distAgentToShop !== null && o.distAgentToShop <= RADIUS_KM
    )

    return NextResponse.json({ orders: filtered, gpsRequired: gpsStale, gpsStale })
  } catch (err) {
    console.error('Available orders error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — atomically claim an order (race-condition safe), first-come-first-serve
export async function POST(req: NextRequest) {
  try {
    // ── CSRF protection ──────────────────────────────────────────
    const originCheck = validateOrigin(req)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403 })
    }

    // ── Rate limit: 10 accept attempts per minute per IP ─────────
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = await checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 10,
      endpoint: 'delivery-accept',
      message: 'Too many accept attempts. Please slow down.',
    })
    if (!rateCheck.allowed) {
      logger.warn('Rate limit hit for delivery accept', { agentId: 'unknown', identifier })
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const auth = await verifyDeliveryAgent(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createServiceClient()
    const now = new Date()

    // ── COMPREHENSIVE AGENT STATE VALIDATION ─────────────────────
    const { data: agentRow } = await supabase
      .from('delivery_agents')
      .select(`
        is_approved, is_available, is_blocked, is_suspended,
        last_lat, last_lon, last_updated
      `)
      .eq('id', auth.agentId)
      .single()

    if (!agentRow) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    if (!agentRow.is_approved) {
      return NextResponse.json({ error: 'Agent not approved' }, { status: 403 })
    }
    if (!agentRow.is_available) {
      return NextResponse.json({ error: 'Agent is offline' }, { status: 403 })
    }
    if (agentRow.is_blocked) {
      logger.auth('blocked_agent_accept_attempt', { agentId: auth.agentId })
      return NextResponse.json({ error: 'Account blocked. Contact support.' }, { status: 403 })
    }
    if (agentRow.is_suspended) {
      logger.auth('suspended_agent_accept_attempt', { agentId: auth.agentId })
      return NextResponse.json({ error: 'Account suspended. Contact support.' }, { status: 403 })
    }

    // ── GPS VALIDATION ──────────────────────────────────────────
    const agentLat = agentRow.last_lat as number | null
    const agentLon = agentRow.last_lon as number | null
    const lastUpdated = agentRow.last_updated as string | null
    const hasGps = !!(agentLat && agentLon)

    if (!hasGps) {
      return NextResponse.json({ error: 'GPS location required. Please enable location services and try again.', gpsRequired: true }, { status: 400 })
    }

    // GPS freshness check — reject if > 15 min old
    let gpsIsFresh = false
    if (lastUpdated) {
      const gpsAge = now.getTime() - new Date(lastUpdated).getTime()
      gpsIsFresh = gpsAge <= GPS_FRESHNESS_MS
    }
    if (!gpsIsFresh) {
      return NextResponse.json({
        error: 'GPS location is too old. Please refresh your location and try again.',
        gpsStale: true,
        gpsRequired: true,
      }, { status: 400 })
    }

    // ── Check active order limit ────────────────────────────────────
    const { count: activeCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', auth.agentId)
      .in('status', ['agent_assigned', 'picked_up', 'out_for_delivery'])

    if (activeCount != null && activeCount >= MAX_ACTIVE_ORDERS) {
      return NextResponse.json({ error: 'You already have an active delivery. Complete it first.' }, { status: 409 })
    }

    // ── RADIUS RE-VERIFICATION AT ACCEPT TIME ────────────────────
    // Fetch the order to get shop location and verify distance
    const { data: orderCheck } = await supabase
      .from('orders')
      .select('id, shops!inner(latitude, longitude)')
      .eq('id', orderId)
      .in('status', ['shop_accepted', 'order_packed'])
      .is('agent_id', null)
      .single()

    if (!orderCheck) {
      // Order may have been taken — this will be caught by the atomic update below
      // but we do an early check to avoid spamming radius re-verification
      return NextResponse.json({ error: 'Order already accepted by another agent', alreadyClaimed: true }, { status: 409 })
    }

    const shop = orderCheck.shops as { latitude?: number; longitude?: number } | null
    if (shop?.latitude && shop?.longitude) {
      const distKm = haversineKm(agentLat!, agentLon!, shop.latitude, shop.longitude)
      if (distKm > RADIUS_KM) {
        logger.warn('Agent outside radius at accept time', {
          agentId: auth.agentId,
          orderId,
          distanceKm: distKm,
          radiusKm: RADIUS_KM,
        })
        return NextResponse.json({
          error: `You are ${distKm.toFixed(1)}km from the shop (max ${RADIUS_KM}km). Get closer to accept.`,
          outsideRadius: true,
          distanceKm: parseFloat(distKm.toFixed(1)),
          maxRadiusKm: RADIUS_KM,
        }, { status: 409 })
      }
    }

    // ── Atomic assignment: only succeeds if status is shop_accepted or order_packed,
    //     AND agent_id IS NULL (prevents double-accept) ──────────────
    const { data, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'agent_assigned',
        agent_id: auth.agentId,
      })
      .in('status', ['shop_accepted', 'order_packed'])
      .is('agent_id', null)
      .select('id, order_number')

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    if (!data || data.length === 0) {
      // Order was taken between the early check and the update — log it
      logger.warn('Race condition: order accepted between check and update', {
        agentId: auth.agentId,
        orderId,
      })
      return NextResponse.json({ error: 'Order already accepted by another agent', alreadyClaimed: true }, { status: 409 })
    }

    // ── Log status history ──────────────────────────────────────────
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: 'agent_assigned',
      changed_by: auth.agentId,
    })

    logger.order('agent_accepted', orderId, { agentId: auth.agentId })

    return NextResponse.json({ success: true, order: data[0] })
  } catch (err) {
    console.error('Accept order error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
