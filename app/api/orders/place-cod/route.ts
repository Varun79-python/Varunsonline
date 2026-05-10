import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const {
      customerId, shopId, addressId, cart,
      subtotal, deliveryCharge, platformFee,
      couponDiscount, total, agentEarning, shopEarning, adminEarning,
      couponCode
    } = await req.json()

    if (!customerId || !shopId || !addressId || !cart?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Place order with COD payment method
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId,
        shop_id: shopId,
        address_id: addressId,
        status: 'payment_confirmed',
        payment_method: 'cod',
        payment_status: 'cod_pending',
        subtotal,
        platform_fee: platformFee,
        delivery_charge: deliveryCharge,
        discount_amount: couponDiscount || 0,
        total_amount: total,
        shopkeeper_earning: shopEarning,
        agent_earning: agentEarning,
        admin_earning: adminEarning,
        coupon_code: couponCode || null,
      })
      .select()
      .single()

    if (orderErr || !order) {
      console.error('COD order error:', orderErr)
      return NextResponse.json({ error: orderErr?.message || 'Failed to create order' }, { status: 500 })
    }

    // Insert order items
    await supabase.from('order_items').insert(
      cart.map((i: { product_id: string; name: string; image_url: string; quantity: number; price: number }) => ({
        order_id: order.id,
        product_id: i.product_id,
        product_name: i.name,
        product_image_url: i.image_url,
        quantity: i.quantity,
        unit_price: i.price,
        total_price: i.price * i.quantity,
      }))
    )

    // Status history
    await supabase.from('order_status_history').insert({
      order_id: order.id, status: 'payment_confirmed', changed_by: customerId
    })

    // Notification to shop
    try {
      await supabase.from('notifications').insert({
        user_id: shopId, title: '🛒 New COD Order!',
        body: `Cash order ${order.order_number} received`, type: 'new_order',
        data: { order_id: order.id }
      })
    } catch { /* optional */ }

    return NextResponse.json({ success: true, orderId: order.id })
  } catch (err) {
    console.error('Place COD order error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
