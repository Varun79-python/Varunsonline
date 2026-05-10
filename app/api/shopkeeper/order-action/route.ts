import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { orderId, action, reason } = await req.json()
    if (!orderId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify order is still pending before updating
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, shop_id')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const now = new Date().toISOString()
    let updateData: Record<string, string> = {}

    // Each action requires the correct preceding status
    if (action === 'accept') {
      if (order.status !== 'payment_confirmed')
        return NextResponse.json({ error: 'Order already processed', currentStatus: order.status }, { status: 409 })
      const otp = Math.floor(1000 + Math.random() * 9000).toString()
      updateData = { status: 'shop_accepted', accepted_at: now, delivery_otp: otp }

    } else if (action === 'reject') {
      if (order.status !== 'payment_confirmed')
        return NextResponse.json({ error: 'Order already processed', currentStatus: order.status }, { status: 409 })
      updateData = { status: 'rejected', rejection_reason: reason || '' }

    } else if (action === 'pack') {
      if (order.status !== 'shop_accepted')
        return NextResponse.json({ error: 'Order must be accepted before packing', currentStatus: order.status }, { status: 409 })
      updateData = { status: 'order_packed', packed_at: now }

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }


    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (updateError) {
      console.error('Order update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log status history
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: updateData.status
    })

    return NextResponse.json({ success: true, newStatus: updateData.status })
  } catch (err) {
    console.error('Order action error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
