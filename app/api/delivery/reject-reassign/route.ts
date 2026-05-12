import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const MAX_REASSIGN_ATTEMPTS = 5   // guard against infinite loops

/**
 * POST /api/delivery/reject-reassign
 * Body: { orderId: string; agentId: string; excludeAgentIds?: string[] }
 *
 * Called when a delivery agent rejects/skips an assigned order.
 * - Unassigns the current agent
 * - Finds the next best available agent (excluding all previously rejected agents)
 * - Atomically reassigns
 * - Stops after MAX_REASSIGN_ATTEMPTS to avoid infinite loops
 */
export async function POST(req: NextRequest) {
  try {
    const { orderId, agentId, excludeAgentIds = [] } = await req.json()
    if (!orderId || !agentId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify order still exists and is agent_assigned
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, agent_id, shops:shop_id(latitude, longitude)')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Build the full exclusion list (current agent + all previous rejectors)
    const fullExclude: string[] = [...new Set([...excludeAgentIds, agentId])]

    // Guard: stop reassigning after too many attempts
    if (fullExclude.length >= MAX_REASSIGN_ATTEMPTS) {
      // Reset order to order_packed so shopkeeper can manually handle
      await supabase.from('orders').update({ agent_id: null, status: 'order_packed' }).eq('id', orderId)
      await supabase.from('order_status_history').insert({ order_id: orderId, status: 'order_packed' })
      return NextResponse.json({ error: 'max_attempts_reached', orderId }, { status: 200 })
    }

    // Unassign current agent
    await supabase.from('orders').update({ agent_id: null, status: 'order_packed' }).eq('id', orderId)

    // Find agents who already have an active order (enforce 1 order per agent)
    const { data: busyAgentRows } = await supabase
      .from('orders')
      .select('agent_id')
      .in('status', ['agent_assigned', 'picked_up', 'out_for_delivery'])
      .not('agent_id', 'is', null)

    const busyIds: string[] = (busyAgentRows || [])
      .map((r: { agent_id: string | null }) => r.agent_id)
      .filter(Boolean) as string[]

    // Combine all exclusions: explicitly excluded + currently busy agents
    const combinedExclude = [...new Set([...fullExclude, ...busyIds])]

    // Find next best agent
    let query = supabase
      .from('delivery_agents')
      .select('id, full_name, total_deliveries, last_lat, last_lon')
      .eq('is_approved', true)
      .eq('is_available', true)

    if (combinedExclude.length > 0) {
      query = query.not('id', 'in', `(${combinedExclude.join(',')})`)
    }

    const { data: agents } = await query

    if (!agents || agents.length === 0) {
      return NextResponse.json({ error: 'no_agents', orderId }, { status: 200 })
    }

    function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
      const R = 6371
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLon = (lon2 - lon1) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    type Agent = { id: string; full_name: string; total_deliveries: number; last_lat: number | null; last_lon: number | null }

    const shopLat = (order.shops as unknown as { latitude: number; longitude: number } | null)?.latitude ?? null
    const shopLon = (order.shops as unknown as { latitude: number; longitude: number } | null)?.longitude ?? null

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

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'race_condition' }, { status: 409 })
    }

    await supabase.from('order_status_history').insert({
      order_id: orderId, status: 'agent_assigned', changed_by: best.id
    })

    return NextResponse.json({
      success: true,
      agentId: best.id,
      agentName: best.full_name,
      excludeAgentIds: fullExclude
    })
  } catch (err) {
    console.error('Reject-reassign error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
