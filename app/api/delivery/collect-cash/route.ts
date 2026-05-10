import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { orderId, agentId } = await req.json()
    if (!orderId || !agentId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch order
    const { data: order } = await supabase
      .from('orders')
      .select('id, agent_id, total_amount, payment_status, payment_method, order_number')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.agent_id !== agentId) return NextResponse.json({ error: 'Not your order' }, { status: 403 })
    if (order.payment_method !== 'cod') return NextResponse.json({ error: 'Not a COD order' }, { status: 400 })
    if (order.payment_status === 'paid') return NextResponse.json({ error: 'Cash already recorded' }, { status: 409 })

    // Mark payment collected
    await supabase.from('orders').update({
      payment_status: 'paid',
      cod_collected_at: new Date().toISOString()
    }).eq('id', orderId)

    // Deduct total_amount from agent wallet (agent owes platform until they remit)
    const { data: agent } = await supabase
      .from('delivery_agents')
      .select('wallet_balance')
      .eq('id', agentId)
      .single()

    const currentBalance = agent?.wallet_balance || 0
    const newBalance = currentBalance - order.total_amount

    await supabase
      .from('delivery_agents')
      .update({ wallet_balance: newBalance })
      .eq('id', agentId)

    // Record wallet transaction
    try {
      await supabase.from('wallet_transactions').insert({
        agent_id: agentId,
        amount: -order.total_amount,
        type: 'cod_collection',
        description: `COD collected for order ${order.order_number} — remit to platform`,
        balance_after: newBalance,
        order_id: orderId
      })
    } catch { /* optional table */ }

    return NextResponse.json({
      success: true,
      newWalletBalance: newBalance,
      isNegative: newBalance < 0,
      message: newBalance < 0
        ? `⚠️ Wallet balance: ₹${newBalance}. Please remit ₹${Math.abs(newBalance)} to the platform.`
        : `✅ Cash recorded. Wallet balance: ₹${newBalance}`
    })
  } catch (err) {
    console.error('Collect cash error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
