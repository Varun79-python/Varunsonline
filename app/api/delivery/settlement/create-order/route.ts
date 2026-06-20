import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyDeliveryAgent } from '@/modules/authentication/services/authMiddleware'

// POST state-changing endpoint

/**
 * POST /api/delivery/settlement/create-order
 * Body: { amount: number }
 *
 * Creates a Razorpay order for the agent to pay back COD cash owed to the platform.
 * Returns: Razorpay order object (id, amount, currency, key_id)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyDeliveryAgent(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Payment gateway is not configured' }, { status: 500 })
    }

    const { amount } = await req.json()
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Fetch agent's current pending balance
    const { data: agent } = await supabase
      .from('delivery_agents')
      .select('wallet_balance, full_name')
      .eq('id', auth.agentId)
      .single()

    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    // pending_balance is the negative of wallet_balance (when wallet < 0, agent owes platform)
    const pendingBalance = agent.wallet_balance < 0 ? Math.abs(agent.wallet_balance) : 0
    if (pendingBalance <= 0) {
      return NextResponse.json({ error: 'No pending balance to settle', pendingBalance: 0 }, { status: 400 })
    }

    // Clamp to actual owed amount
    const settleAmount = Math.min(amount, pendingBalance)

    if (!auth.agentId) return NextResponse.json({ error: 'Agent ID not found' }, { status: 400 })

    const Razorpay = (await import('razorpay')).default
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })

    const receipt = `settle_${auth.agentId.slice(0, 8)}_${Date.now()}`
    const order = await razorpay.orders.create({
      amount: Math.round(settleAmount * 100), // paise
      currency: 'INR',
      receipt,
      notes: {
        agentId: auth.agentId,
        agentName: agent.full_name,
        type: 'cod_settlement',
        pendingBalance: pendingBalance.toString()
      }
    })

    return NextResponse.json({
      ...order,
      key_id: keyId,
      settleAmount,
      pendingBalance,
      agentName: agent.full_name
    })
  } catch (err) {
    console.error('Settlement create-order error:', err)
    return NextResponse.json({ error: 'Failed to create settlement order' }, { status: 500 })
  }
}
