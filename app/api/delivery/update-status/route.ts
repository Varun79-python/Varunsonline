import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyDeliveryAgent, validateOrigin } from '@/modules/authentication/services/authMiddleware'
import { processEarnings } from '../utils'
import { checkRateLimit, getRateLimitIdentifier } from '@/modules/authentication/services/rateLimit'

// POST state-changing endpoint

export async function POST(req: NextRequest) {
  try {
    // ── CSRF protection ──────────────────────────────────────────
    const originCheck = validateOrigin(req)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403 })
    }

    // Rate limit: 20 status updates per minute
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = await checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 20,
      endpoint: 'delivery-status-update',
      message: 'Too many status updates. Please slow down.',
    })
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const auth = await verifyDeliveryAgent(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { orderId, status } = await req.json()
    if (!orderId || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createServiceClient()

    // Verify this agent owns the order before updating
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, agent_id, agent_earning, payment_method')
      .eq('id', orderId)
      .eq('agent_id', auth.agentId)  // security: only the logged-in agent can update
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found or not assigned to you' }, { status: 404 })

    // STRICT: COD orders MUST use collect-cash endpoint (creates settlement ledger)
    // Block direct "delivered" status update for COD orders
    if (order.payment_method === 'cod' && status === 'delivered') {
      return NextResponse.json({
        error: 'COD orders require cash/QR collection. Use Collect Payment in the delivery page.'
      }, { status: 400 })
    }

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
      changed_by: auth.agentId
    })

    // If delivered, credit agent and shopkeeper wallets
    if (status === 'delivered') {
      await processEarnings(supabase, orderId)
    }

    return NextResponse.json({ success: true, newStatus: status })
  } catch (err) {
    console.error('Delivery status update error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
