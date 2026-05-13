import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/authMiddleware'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const body = await req.json()
    const {
      customerId, shopId, addressId, cart,
      subtotal, deliveryCharge, platformFee,
      couponDiscount, total, agentEarning, shopEarning, adminEarning,
      couponCode
    } = body

    if (!customerId || !shopId || !addressId || !cart?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // CRITICAL: Verify the requesting user owns this customerId
    if (user.id !== customerId) {
      return NextResponse.json({ error: 'Cannot place order for another user' }, { status: 403 })
    }

    // Verify user has a customer profile
    const serviceSupabase = createServiceClient()
    const { data: profile } = await serviceSupabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'customer') {
      return NextResponse.json({ error: 'Only customers can place orders' }, { status: 403 })
    }

    // Verify address belongs to customer
    const { data: address } = await serviceSupabase.from('addresses').select('customer_id').eq('id', addressId).single()
    if (!address || address.customer_id !== customerId) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }

    // Verify shop exists and is active
    const { data: shop } = await serviceSupabase.from('shops').select('id, is_active').eq('id', shopId).single()
    if (!shop || !shop.is_active) {
      return NextResponse.json({ error: 'Shop not available' }, { status: 400 })
    }

    // Place order with COD payment method
    const { data: order, error: orderErr } = await serviceSupabase
      .from('orders')
      .insert({
        customer_id: customerId,
        shop_id: shopId,
        address_id: addressId,
        status: 'payment_confirmed',
        payment_method: 'cod',
        payment_status: 'pending',
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
    await serviceSupabase.from('order_items').insert(
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
    await serviceSupabase.from('order_status_history').insert({
      order_id: order.id, status: 'payment_confirmed', changed_by: customerId
    })

    // Notification to shop owner
    try {
      const { data: shopOwner } = await serviceSupabase.from('shops').select('owner_id').eq('id', shopId).single()
      if (shopOwner?.owner_id) {
        await serviceSupabase.from('notifications').insert({
          user_id: shopOwner.owner_id, title: '🛒 New COD Order!',
          body: `Cash order ${order.order_number} received`, type: 'new_order',
          data: { order_id: order.id }
        })
      }
    } catch { /* optional */ }

    return NextResponse.json({ success: true, orderId: order.id })
  } catch (err) {
    console.error('Place COD order error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
