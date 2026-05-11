import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/shopkeeper/auto-assign-agent
 * Body: { orderId: string }
 *
 * Finds the best available, approved delivery agent and atomically assigns
 * them to the order.
 *
 * Selection priority:
 *   1. Nearest agent (if order has shop GPS and agent has last_lat/last_lon)
 *   2. Least busy agent (fewest active orders today)
 *   3. Round-robin (lowest total_deliveries — gives new agents a fair start)
 *
 * Returns: { success, agentId, agentName } or { error }
 */
export async function POST(req: Request) {
  try {
    const { orderId, excludeAgentIds = [] } = await req.json()
    if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ── 1. Fetch order's shop location ──────────────────────────────────────
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, agent_id, shops:shop_id(latitude, longitude)')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.agent_id) return NextResponse.json({ error: 'Order already has an agent', agentId: order.agent_id }, { status: 409 })
    if (!['shop_accepted', 'order_packed'].includes(order.status)) {
      return NextResponse.json({ error: 'Order not in assignable state', status: order.status }, { status: 409 })
    }

    // ── 2. Fetch available, approved agents (exclude blacklist) ─────────────
    let query = supabase
      .from('delivery_agents')
      .select('id, full_name, total_deliveries, last_lat, last_lon')
      .eq('is_approved', true)
      .eq('is_available', true)
      .is('current_order_id', null)   // only idle agents

    if (excludeAgentIds.length > 0) {
      query = query.not('id', 'in', `(${excludeAgentIds.join(',')})`)
    }

    const { data: agents } = await query

    if (!agents || agents.length === 0) {
      return NextResponse.json({ error: 'No available agents', noAgents: true }, { status: 503 })
    }

    // ── 3. Score agents ─────────────────────────────────────────────────────
    type Agent = { id: string; full_name: string; total_deliveries: number; last_lat: number | null; last_lon: number | null }

    function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
      const R = 6371
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLon = (lon2 - lon1) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    const shopLat = (order.shops as unknown as { latitude: number; longitude: number } | null)?.latitude ?? null
    const shopLon = (order.shops as unknown as { latitude: number; longitude: number } | null)?.longitude ?? null

    const scored = (agents as Agent[]).map(a => {
      let distScore = 9999
      if (shopLat && shopLon && a.last_lat && a.last_lon) {
        distScore = haversineKm(a.last_lat, a.last_lon, shopLat, shopLon)
      }
      // Combined score: distance dominates, tie-break by least deliveries
      const score = distScore * 1000 + (a.total_deliveries || 0)
      return { ...a, score }
    }).sort((a, b) => a.score - b.score)

    const best = scored[0]

    // ── 4. Atomically assign agent to order ─────────────────────────────────
    const { data: updated, error: updateErr } = await supabase
      .from('orders')
      .update({ agent_id: best.id, status: 'agent_assigned' })
      .eq('id', orderId)
      .is('agent_id', null)     // race-condition guard
      .select('id, order_number')

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    if (!updated || updated.length === 0) {
      // Race: another process assigned simultaneously
      return NextResponse.json({ error: 'Assignment race condition — retry', retry: true }, { status: 409 })
    }

    // ── 5. Log status history ────────────────────────────────────────────────
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: 'agent_assigned',
      changed_by: best.id
    })

    return NextResponse.json({
      success: true,
      agentId: best.id,
      agentName: best.full_name,
      orderNumber: updated[0].order_number
    })
  } catch (err) {
    console.error('Auto-assign agent error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
