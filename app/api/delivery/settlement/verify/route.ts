import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyDeliveryAgent } from '@/lib/authMiddleware'

export const dynamic = 'force-dynamic'

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * POST /api/delivery/settlement/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, settleAmount }
 *
 * 1. Verifies Razorpay payment signature.
 * 2. Checks for duplicate settlement (idempotency).
 * 3. Reduces agent's pending balance (increases wallet_balance toward 0).
 * 4. Logs a wallet transaction.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyDeliveryAgent(req)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Payment verification is not configured' }, { status: 500 })
  }

  try {
    const { agentId, razorpay_order_id, razorpay_payment_id, razorpay_signature, settleAmount } = await req.json()

    if (!agentId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !settleAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // ── 1. Verify Razorpay signature ─────────────────────────────────────────
    const expectedSig = createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (!safeCompare(expectedSig, razorpay_signature)) {
      return NextResponse.json({ verified: false, error: 'Invalid payment signature' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // ── 2. Idempotency check — prevent duplicate credits ──────────────────────
    try {
      const { data: existing } = await supabase
        .from('wallet_transactions')
        .select('id')
        .eq('razorpay_payment_id', razorpay_payment_id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          message: 'Payment already processed'
        })
      }
    } catch {
      // razorpay_payment_id column may not exist yet — continue
    }

    // ── 3. Fetch agent wallet ─────────────────────────────────────────────────
    const { data: agent } = await supabase
      .from('delivery_agents')
      .select('wallet_balance, full_name')
      .eq('id', agentId)
      .single()

    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    const amount = Number(settleAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid settlement amount' }, { status: 400 })
    }

    // ── 4. Update wallet — reduce debt (add positive amount to negative balance) ──
    const newBalance = parseFloat(((agent.wallet_balance || 0) + amount).toFixed(2))

    await supabase
      .from('delivery_agents')
      .update({ wallet_balance: newBalance })
      .eq('id', agentId)

    // ── 5. Log settlement transaction ────────────────────────────────────────
    try {
      await supabase.from('wallet_transactions').insert({
        user_id: agentId,
        user_type: 'delivery_agent',
        type: 'settlement',
        amount,
        description: `COD settlement payment of ₹${amount.toFixed(2)} via Razorpay`,
        balance_after: newBalance,
        razorpay_payment_id,
        razorpay_order_id
      })
    } catch {
      // Fallback: insert without razorpay columns if they don't exist yet
      try {
        await supabase.from('wallet_transactions').insert({
          user_id: agentId,
          user_type: 'delivery_agent',
          type: 'settlement',
          amount,
          description: `COD settlement payment of ₹${amount.toFixed(2)} via Razorpay (${razorpay_payment_id})`,
          balance_after: newBalance
        })
      } catch { /* non-critical logging failure */ }
    }

    return NextResponse.json({
      success: true,
      verified: true,
      newWalletBalance: newBalance,
      settled: amount,
      message: newBalance >= 0
        ? `✅ Settlement complete! Wallet balance: ₹${newBalance}`
        : `✅ ₹${amount.toFixed(2)} settled. Remaining balance owed: ₹${Math.abs(newBalance).toFixed(2)}`
    })
  } catch (err) {
    console.error('Settlement verify error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
