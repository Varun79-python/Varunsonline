import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyShopkeeper } from '@/modules/authentication/services/authMiddleware'
import { checkRateLimit, getRateLimitIdentifier } from '@/modules/authentication/services/rateLimit'

// POST state-changing endpoint

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 20 order actions per minute
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = await checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 20,
      message: 'Too many order actions. Please slow down.',
    })
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const auth = await verifyShopkeeper(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { orderId, action, reason } = await req.json()
    if (!orderId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createServiceClient()

    const { data: order } = await supabase
      .from('orders')
      .select('id, status, shop_id')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Verify shop owns this order
    if (order.shop_id !== auth.shopId) {
      return NextResponse.json({ error: 'Not authorized to manage this order' }, { status: 403 })
    }

    const now = new Date().toISOString()
    let updateData: Record<string, string> = {}

    if (action === 'accept') {
      if (order.status !== 'payment_confirmed' && order.status !== 'placed')
        return NextResponse.json({ error: 'Order already processed', currentStatus: order.status }, { status: 409 })
      const otp = Math.floor(1000 + Math.random() * 9000).toString()
      updateData = { status: 'shop_accepted', accepted_at: now, delivery_otp: otp }

    } else if (action === 'reject') {
      if (order.status !== 'payment_confirmed' && order.status !== 'placed')
        return NextResponse.json({ error: 'Order already processed', currentStatus: order.status }, { status: 409 })

      // Restore product stock before rejecting
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', orderId)
      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          try {
            await supabase.rpc('increment_stock', {
              p_product_id: item.product_id,
              p_quantity: item.quantity,
            })
          } catch (err) {
            console.error(`Failed to restore stock for product ${item.product_id}:`, err)
          }
        }
      }

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

    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: updateData.status
    })

    return NextResponse.json({
      success: true,
      newStatus: updateData.status,
    })
  } catch (err) {
    console.error('Order action error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
