import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyDeliveryAgent } from '@/lib/authMiddleware'
import { processEarnings } from '../utils'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyDeliveryAgent(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { orderId, paymentMethod } = await req.json()
    // paymentMethod: 'qr' (UPI) | 'cash'
    if (!orderId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createServiceClient()

    // Fetch order — must be COD, OTP verified, not yet delivered
    const { data: order } = await supabase
      .from('orders')
      .select('id, agent_id, total_amount, payment_status, payment_method, order_number, status, otp_verified, agent_earning')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.agent_id !== auth.agentId) return NextResponse.json({ error: 'Not your order' }, { status: 403 })
    if (order.payment_method !== 'cod') return NextResponse.json({ error: 'Not a COD order' }, { status: 400 })
    if (order.status === 'delivered') return NextResponse.json({ error: 'Already delivered', alreadyDone: true }, { status: 409 })
    if (!order.otp_verified) return NextResponse.json({ error: 'OTP not verified yet' }, { status: 400 })

    const now = new Date().toISOString()
    const collectedAmount = Math.max(0, order.total_amount)
    const method = paymentMethod || 'cash'

    // 1. Mark order as delivered + payment collected
    await supabase.from('orders').update({
      status: 'delivered',
      payment_status: 'paid',
      cod_collected_at: now,
      delivered_at: now,
      cod_payment_method: method,  // 'qr' or 'cash'
    }).eq('id', orderId)

    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: 'delivered',
      changed_by: agentId
    })

    // 2. Credit shop + agent earnings (processEarnings handles wallet credits)
    await processEarnings(supabase, orderId)

    // 3. Handle agent cash accountability
    // Re-fetch agent wallet AFTER processEarnings (earnings just credited)
    const { data: agent } = await supabase
      .from('delivery_agents')
      .select('wallet_balance')
      .eq('id', agentId)
      .single()

    const balanceAfterEarnings = agent?.wallet_balance || 0

    let newBalance: number
    let settlementNote: string

    if (method === 'qr') {
      // QR / UPI — customer paid the platform directly via UPI
      // Agent doesn't owe cash — just record the transaction
      newBalance = balanceAfterEarnings
      settlementNote = `QR/UPI payment collected for order ${order.order_number}`

      await supabase.from('wallet_transactions').insert({
        user_id: agentId,
        user_type: 'delivery_agent',
        type: 'info',
        amount: collectedAmount,
        description: settlementNote,
        order_id: orderId
      })
    } else {
      // Cash — agent collected cash on behalf of platform
      // Deduct from wallet: agent owes this cash to platform
      newBalance = balanceAfterEarnings - collectedAmount
      settlementNote = `Cash collected for order ${order.order_number} — remit ₹${collectedAmount} to platform`

      await supabase.from('delivery_agents')
        .update({ wallet_balance: newBalance })
        .eq('id', agentId)

      await supabase.from('wallet_transactions').insert({
        user_id: agentId,
        user_type: 'delivery_agent',
        type: 'debit',
        amount: collectedAmount,
        description: settlementNote,
        order_id: orderId
      })
    }

    return NextResponse.json({
      success: true,
      newWalletBalance: newBalance,
      isNegative: newBalance < 0,
      method,
      message: newBalance < 0
        ? `⚠️ Cash recorded! You owe ₹${Math.abs(newBalance)} to the platform. Settle via Wallet page.`
        : `✅ ${method === 'qr' ? 'UPI payment' : 'Cash'} recorded! Wallet balance: ₹${newBalance.toFixed(2)}`
    })
  } catch (err) {
    console.error('Collect cash error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
