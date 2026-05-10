import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const MAX_ATTEMPTS = 3

export async function POST(req: NextRequest) {
  try {
    const { orderId, agentId, enteredOtp } = await req.json()
    if (!orderId || !agentId || !enteredOtp) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch order — verify this agent is assigned
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, status, delivery_otp, otp_verified, otp_attempts, agent_id, agent_earning, total_amount, payment_method, order_number')
      .eq('id', orderId)
      .single()

    if (fetchErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.agent_id !== agentId) return NextResponse.json({ error: 'Not your order' }, { status: 403 })
    if (order.status === 'delivered') return NextResponse.json({ error: 'Already delivered', alreadyDone: true }, { status: 409 })
    if (order.otp_verified) return NextResponse.json({ error: 'Already verified', alreadyDone: true }, { status: 409 })

    const attempts = order.otp_attempts || 0

    // Locked after MAX_ATTEMPTS wrong tries
    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({
        error: `Too many wrong attempts. Contact support.`,
        locked: true,
        attemptsUsed: attempts
      }, { status: 429 })
    }

    // Wrong OTP
    if (enteredOtp.trim() !== order.delivery_otp) {
      const newAttempts = attempts + 1
      await supabase.from('orders').update({ otp_attempts: newAttempts }).eq('id', orderId)
      const attemptsLeft = MAX_ATTEMPTS - newAttempts
      return NextResponse.json({
        error: `Wrong code. ${attemptsLeft > 0 ? `${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} left.` : 'No attempts left. Locked.'}`,
        wrong: true,
        attemptsLeft,
        locked: attemptsLeft <= 0
      }, { status: 400 })
    }

    // ✅ Correct OTP — mark as delivered
    const now = new Date().toISOString()
    const { error: updateErr } = await supabase.from('orders').update({
      status: 'delivered',
      otp_verified: true,
      otp_attempts: attempts + 1,
      delivered_at: now
    }).eq('id', orderId)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Log status history
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: 'delivered',
      changed_by: agentId
    })

    // Credit agent wallet
    if (order.agent_earning > 0) {
      try {
        await supabase.rpc('credit_agent_wallet', { p_agent_id: agentId, p_amount: order.agent_earning })
      } catch { /* RPC optional */ }
    }

    const isCod = order.payment_method === 'cod'

    return NextResponse.json({
      success: true,
      isCod,
      amount: order.total_amount,
      message: isCod
        ? `✅ OTP verified! Collect ₹${order.total_amount} cash from customer.`
        : `✅ Delivery confirmed for ${order.order_number}!`
    })

  } catch (err) {
    console.error('OTP verify error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
