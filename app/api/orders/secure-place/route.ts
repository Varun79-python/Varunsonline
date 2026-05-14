import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const dynamic = 'force-dynamic'

interface CartItem {
  product_id: string
  quantity: number
}

interface OrderRequest {
  shopId: string
  addressId: string
  cart: CartItem[]
  paymentMethod: 'online' | 'cod'
  couponCode?: string
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 order placements per minute
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 5,
      message: 'Too many orders. Please wait a moment.',
    })

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createServiceClient()

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Verify user is a customer
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'customer') {
      return NextResponse.json({ error: 'Only customers can place orders' }, { status: 403 })
    }

    const body: OrderRequest = await req.json()
    const { shopId, addressId, cart, paymentMethod, couponCode } = body

    // Validate required fields
    if (!shopId || !addressId || !cart?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify customer owns the address
    const { data: address } = await supabase
      .from('addresses')
      .select('latitude, longitude, customer_id')
      .eq('id', addressId)
      .single()

    if (!address || address.customer_id !== user.id) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }

    // Verify shop exists, is active, and is approved
    const { data: shop } = await supabase
      .from('shops')
      .select('id, owner_id, latitude, longitude, is_active, is_approved')
      .eq('id', shopId)
      .single()

    if (!shop || !shop.is_active || !shop.is_approved) {
      return NextResponse.json({ error: 'Shop not available' }, { status: 400 })
    }

    // SERVER-SIDE VALIDATION: Check shop is within allowed radius
    if (shop.latitude && shop.longitude && address.latitude && address.longitude) {
      const distance = getDistance(address.latitude, address.longitude, shop.latitude, shop.longitude)

      // Get radius from platform settings (default 10km)
      const { data: radiusSetting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'shop_radius_km')
        .single()

      const maxRadius = radiusSetting ? parseFloat(radiusSetting.value) : 10

      if (distance > maxRadius) {
        return NextResponse.json({ error: 'Shop is outside delivery radius' }, { status: 400 })
      }
    }

    // SERVER-SIDE VALIDATION: Fetch product prices from database
    const productIds = cart.map(c => c.product_id)
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, price, stock_quantity, is_available, shop_id')
      .in('id', productIds)

    if (prodError || !products?.length) {
      return NextResponse.json({ error: 'Products not found' }, { status: 400 })
    }

    // Verify all products belong to the shop and are available
    const productMap = new Map(products.map(p => [p.id, p]))
    for (const item of cart) {
      const product = productMap.get(item.product_id)
      if (!product) {
        return NextResponse.json({ error: `Product ${item.product_id} not found` }, { status: 400 })
      }
      if (product.shop_id !== shopId) {
        return NextResponse.json({ error: 'Product does not belong to this shop' }, { status: 400 })
      }
      if (!product.is_available) {
        return NextResponse.json({ error: `Product ${product.name} is not available` }, { status: 400 })
      }
      if (product.stock_quantity < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}` }, { status: 400 })
      }
    }

    // SERVER-SIDE VALIDATION: Calculate prices
    let subtotal = 0
    const orderItems = cart.map(item => {
      const product = productMap.get(item.product_id)!
      const itemTotal = product.price * item.quantity
      subtotal += itemTotal
      return {
        product_id: item.product_id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        total_price: itemTotal,
      }
    })

    // Get platform settings
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['base_delivery_charge', 'per_km_delivery_charge', 'platform_fee_percent', 'min_order_amount'])

    const settingsMap = new Map(settings?.map(s => [s.key, s.value]))
    const baseDeliveryCharge = parseFloat(settingsMap.get('base_delivery_charge') || '30')
    const perKmCharge = parseFloat(settingsMap.get('per_km_delivery_charge') || '5')
    const platformFeePercent = parseFloat(settingsMap.get('platform_fee_percent') || '5')
    const minOrderAmount = parseFloat(settingsMap.get('min_order_amount') || '50')

    // Validate minimum order
    if (subtotal < minOrderAmount) {
      return NextResponse.json({ error: `Minimum order amount is ₹${minOrderAmount}` }, { status: 400 })
    }

    // Calculate delivery charge based on distance
    let deliveryCharge = baseDeliveryCharge
    if (shop.latitude && shop.longitude && address.latitude && address.longitude) {
      const distance = getDistance(address.latitude, address.longitude, shop.latitude, shop.longitude)
      deliveryCharge = baseDeliveryCharge + Math.ceil(distance) * perKmCharge
    }

    // Calculate platform fee
    const platformFee = Math.round((subtotal * platformFeePercent) / 100)

    // Validate coupon if provided
    let couponDiscount = 0
    if (couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('id, discount_type, discount_value, min_order_amount, max_discount, usage_limit, used_count, is_active, valid_until')
        .eq('code', couponCode)
        .single()

      if (coupon && coupon.is_active) {
        if (!coupon.valid_until || new Date(coupon.valid_until) > new Date()) {
          if (!coupon.usage_limit || coupon.used_count < coupon.usage_limit) {
            if (subtotal >= (coupon.min_order_amount || 0)) {
              if (coupon.discount_type === 'percent') {
                couponDiscount = Math.round((subtotal * coupon.discount_value) / 100)
                if (coupon.max_discount && couponDiscount > coupon.max_discount) {
                  couponDiscount = coupon.max_discount
                }
              } else {
                couponDiscount = coupon.discount_value
              }
            }
          }
        }
      }
    }

    // Calculate total
    const total = Math.max(0, subtotal + deliveryCharge + platformFee - couponDiscount)

    // Calculate earnings split
    const agentEarning = Math.round(deliveryCharge * 0.8)
    const adminEarning = platformFee + (deliveryCharge - agentEarning) - couponDiscount

    // Create order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        shop_id: shopId,
        address_id: addressId,
        status: paymentMethod === 'cod' ? 'payment_confirmed' : 'payment_pending',
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'cod' ? 'pending' : 'pending',
        subtotal,
        platform_fee: platformFee,
        delivery_charge: deliveryCharge,
        discount_amount: couponDiscount,
        total_amount: total,
        shopkeeper_earning: subtotal,
        agent_earning: agentEarning,
        admin_earning: adminEarning,
        coupon_code: couponCode || null,
      })
      .select()
      .single()

    if (orderErr || !order) {
      console.error('Order creation error:', orderErr)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    // Insert order items with actual DB prices
    await supabase.from('order_items').insert(
      orderItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }))
    )

    // Deduct stock for each item (atomic decrement, prevents overselling)
    for (const item of cart) {
      try {
        await supabase.rpc('decrement_product_stock', {
          product_id_param: item.product_id,
          quantity_param: item.quantity
        })
      } catch (err) {
        console.error('Stock deduction failed for product', item.product_id, err)
      }
    }

    // Record status history
    await supabase.from('order_status_history').insert({
      order_id: order.id,
      status: paymentMethod === 'cod' ? 'payment_confirmed' : 'payment_pending',
      changed_by: user.id,
    })

    // Update coupon usage if used
    if (couponCode) {
      await supabase.rpc('increment_coupon_usage', { coupon_code: couponCode })
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      totalAmount: total,
      subtotal,
      deliveryCharge,
      platformFee,
      couponDiscount,
    })
  } catch (err) {
    console.error('Secure order placement error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}