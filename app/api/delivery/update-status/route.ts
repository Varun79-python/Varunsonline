import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { orderId, agentId, status } = await req.json()
    if (!orderId || !agentId || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify this agent owns the order before updating
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, agent_id, agent_earning')
      .eq('id', orderId)
      .eq('agent_id', agentId)  // security: only the assigned agent can update
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found or not assigned to you' }, { status: 404 })

    const now = new Date().toISOString()
    const validTransitions: Record<string, string> = {
      agent_assigned: 'picked_up',
      picked_up: 'out_for_delivery',
      out_for_delivery: 'delivered'
    }

    if (validTransitions[order.status] !== status) {
      return NextResponse.json({
        error: `Cannot transition from ${order.status} to ${status}`,
        currentStatus: order.status
      }, { status: 409 })
    }

    const extra: Record<string, string> = {}
    if (status === 'picked_up') extra.picked_up_at = now
    if (status === 'out_for_delivery') extra.out_for_delivery_at = now
    if (status === 'delivered') extra.delivered_at = now

    const { error: updateErr } = await supabase
      .from('orders')
      .update({ status, ...extra })
      .eq('id', orderId)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Log to status history
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status,
      changed_by: agentId
    })

    // If delivered, try to credit agent wallet
    if (status === 'delivered' && order.agent_earning > 0) {
      try {
        await supabase.rpc('credit_agent_wallet', { p_agent_id: agentId, p_amount: order.agent_earning })
      } catch { /* RPC optional */ }
    }

    return NextResponse.json({ success: true, newStatus: status })
  } catch (err) {
    console.error('Delivery status update error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
