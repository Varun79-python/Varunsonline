import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyDeliveryAgent } from '@/lib/authMiddleware'
import { processEarnings } from '../utils'

export const dynamic = 'force-dynamic'

/**
 * POST /api/delivery/collect-cash
 * Handles COD payment collection at delivery time.
 * Two payment methods:
 *   1. 'cash' — agent collects physical cash
 *   2. 'qr' — customer pays via Razorpay QR/UPI (verified via webhook)
 *
 * CRITICAL BUSINESS RULES:
 *   - Cash: agent owes (total_amount - agent_earning) to platform
 *   - QR: customer paid platform directly, no settlement due
 *   - COD settlement ledger tracks all dues
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyDeliveryAgent(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { orderId, paymentMethod, idempotencyKey } = await req.json()
    // paymentMethod: 'qr' (UPI/Razorpay QR) | 'cash'
    if (!orderId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createServiceClient()

    // Idempotency: reject if already processed
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('agent_cod_settlement_ledger')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ error: 'Payment already collected for this order' }, { status: 409 })
      }
    }

    // Fetch order — must be COD, OTP verified, not yet delivered
    const { data: order } = await supabase
      .from('orders')
      .select('id, agent_id, total_amount, payment_status, payment_method, order_number, status, otp_verified, agent_earning, shopkeeper_earning, subtotal, platform_fee, delivery_charge')
      .eq('id', orderId)
      .eq('status', 'out_for_delivery')
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found or already delivered' }, { status: 404 })
    if (order.agent_id !== auth.agentId) return NextResponse.json({ error: 'Not your order' }, { status: 403 })
    if (order.payment_method !== 'cod') return NextResponse.json({ error: 'Not a COD order' }, { status: 400 })
    if (!order.otp_verified) return NextResponse.json({ error: 'OTP not verified yet' }, { status: 400 })

    const now = new Date().toISOString()
    const collectedAmount = Math.max(0, order.total_amount)
    const agentEarning = Math.max(0, order.agent_earning)
    const method = paymentMethod || 'cash'

    if (method === 'qr') {
      // ── QR PAYMENT ──────────────────────────────────────────────────────
      // Customer pays the platform directly via Razorpay QR.
      // Payment is verified via webhook before order completes.
      // Mark order as cod_qr_pending — awaiting webhook confirmation
      await supabase.from('orders').update({
        status: 'cod_pending',
        payment_status: 'cod_qr_pending',
        cod_collected_at: now,
        cod_payment_method: 'qr',
      }).eq('id', orderId)

      await supabase.from('order_status_history').insert({
        order_id: orderId,
        status: 'cod_pending',
        changed_by: auth.agentId,
        notes: 'QR payment initiated — awaiting webhook verification'
      })

      return NextResponse.json({
        success: true,
        method: 'qr',
        message: 'QR payment initiated. Waiting for customer to complete payment.',
        requiresVerification: true,
        totalAmount: collectedAmount,
      })
    }

    // ── CASH PAYMENT ──────────────────────────────────────────────────────
    // Agent collected physical cash. Calculate settlement due.
    // settlement_due = total_amount - agent_earning (agent keeps their fee)

    // 1. Mark order as delivered + cash collected
    await supabase.from('orders').update({
      status: 'delivered',
      payment_status: 'cod_cash_collected',
      cod_collected_at: now,
      delivered_at: now,
      cod_payment_method: 'cash',
    }).eq('id', orderId)

    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: 'delivered',
      changed_by: auth.agentId,
      notes: 'Cash collected at delivery'
    })

    // 2. Credit shop + agent earnings (processEarnings handles wallet credits)
    await processEarnings(supabase, orderId)

    // 3. Calculate settlement: agent owes (total_amount - agent_earning) to platform
    //    Agent keeps their delivery earning.
    const settlementDue = collectedAmount - agentEarning

    // 4. Create COD settlement ledger entry
    const { data: existingLedger } = await supabase
      .from('agent_cod_settlement_ledger')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle()

    if (!existingLedger) {
      await supabase.from('agent_cod_settlement_ledger').insert({
        agent_id: auth.agentId,
        order_id: orderId,
        cash_collected: collectedAmount,
        amount_owed_to_platform: settlementDue,
        settled_amount: 0,
        pending_amount: settlementDue,
        status: settlementDue > 0 ? 'pending' : 'settled',
      })
    }

    // 5. Update agent's pending_cod_due by summing ledger
    const { data: totalDueData } = await supabase
      .from('agent_cod_settlement_ledger')
      .select('pending_amount')
      .eq('agent_id', auth.agentId)
      .in('status', ['pending', 'partially_paid'])
    
    const totalPending = (totalDueData || []).reduce((s, r) => s + Number(r.pending_amount || 0), 0)
    
    await supabase.from('delivery_agents')
      .update({ pending_cod_due: totalPending })
      .eq('id', auth.agentId)

    // 6. Record informational transaction for settlement tracking
    // (No wallet deduction — settlement is tracked via agent_cod_settlement_ledger
    //  and auto-recovered from future earnings via processEarnings)
    await supabase.from('wallet_transactions').insert({
      user_id: auth.agentId,
      user_type: 'delivery_agent',
      type: 'info',
      amount: settlementDue,
      description: `COD settlement due for order ${order.order_number} — ₹${settlementDue.toFixed(2)} will be auto-recovered from future earnings`,
      order_id: orderId
    })

    return NextResponse.json({
      success: true,
      newWalletBalance: 0, // Will be refreshed from UI
      method: 'cash',
      settlementDue,
      agentKept: agentEarning,
      message: `✅ Cash collected! You keep ₹${agentEarning.toFixed(2)}. Settlement due: ₹${settlementDue.toFixed(2)}. This will be auto-recovered from future earnings.`
    })
  } catch (err) {
    console.error('Collect cash error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
