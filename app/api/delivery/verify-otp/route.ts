import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyDeliveryAgent } from '@/lib/authMiddleware'
import { processEarnings } from '../utils'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_ATTEMPTS = 3

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 OTP verifications per minute (brute force protection)
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = await checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: 'Too many verification attempts. Please wait.',
    })
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
    }

    const auth = await verifyDeliveryAgent(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { orderId, enteredOtp } = await req.json()
    if (!orderId || !enteredOtp) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Fetch order — verify this agent is assigned
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, status, delivery_otp, otp_verified, otp_attempts, agent_id, agent_earning, total_amount, payment_method, order_number')
      .eq('id', orderId)
      .single()

    if (fetchErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.agent_id !== auth.agentId) return NextResponse.json({ error: 'Not your order' }, { status: 403 })
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

    const isCod = order.payment_method === 'cod'
    const now = new Date().toISOString()

    if (isCod) {
      // ✅ COD: OTP verified but DO NOT mark delivered yet.
      // Keep status = out_for_delivery. Cash must be collected first.
      await supabase.from('orders').update({
        otp_verified: true,
        otp_attempts: attempts + 1,
      }).eq('id', orderId)

      // Return amount agent must collect from customer
      const collectAmount = Math.max(0, order.total_amount)
      return NextResponse.json({
        success: true,
        isCod: true,
        amount: collectAmount,
        message: `✅ OTP verified! Collect ₹${collectAmount} cash from customer.`
      })
    }

    // ✅ Online payment — mark as delivered immediately
    const { error: updateErr } = await supabase.from('orders').update({
      status: 'delivered',
      otp_verified: true,
      otp_attempts: attempts + 1,
      delivered_at: now
    }).eq('id', orderId)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: 'delivered',
      changed_by: auth.agentId
    })

    // Credit agent and shopkeeper wallets (online payment — instant)
    await processEarnings(supabase, orderId)

    return NextResponse.json({
      success: true,
      isCod: false,
      amount: 0,
      message: `✅ Delivery confirmed for ${order.order_number}!`
    })

  } catch (err) {
    console.error('OTP verify error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
