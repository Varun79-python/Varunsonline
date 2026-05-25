import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { recalcOrder } from '@/lib/order-calculations'
import { haversineKm } from '@/lib/gps'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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
  let userId: string | undefined
  let shopId: string | undefined
  let paymentMethod: string | undefined
  try {
    // Rate limit: 5 order placements per minute
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = await checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 5,
      message: 'Too many orders. Please wait a moment.',
    })

    if (!rateCheck.allowed) {
      logger.order('rate_limited', 'unknown')
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
    userId = user.id

    // Verify user is a customer
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'customer') {
      logger.auth('wrong_role', { userId: user.id, expected: 'customer', actual: profile?.role })
      return NextResponse.json({ error: 'Only customers can place orders' }, { status: 403 })
    }

    const body: OrderRequest = await req.json()
    const { shopId: sId, addressId, cart, paymentMethod: pm, couponCode } = body
    shopId = sId
    paymentMethod = pm

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
      const distance = haversineKm(address.latitude, address.longitude, shop.latitude, shop.longitude)

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
      const distance = haversineKm(address.latitude, address.longitude, shop.latitude, shop.longitude)
      deliveryCharge = baseDeliveryCharge + Math.ceil(distance) * perKmCharge
    }

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

    // Calculate all financials using shared logic (single source of truth)
    const financials = recalcOrder(subtotal, deliveryCharge, platformFeePercent, couponDiscount)
    const total = financials.totalAmount

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
        platform_fee: financials.platformFee,
        delivery_charge: deliveryCharge,
        discount_amount: couponDiscount,
        total_amount: total,
        shopkeeper_earning: financials.shopkeeperEarning,
        agent_earning: financials.agentEarning,
        admin_earning: financials.adminEarning,
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

    // Deduct stock for each item — atomic RPC prevents race condition
    for (const item of cart) {
      try {
        const { data: success, error: stockErr } = await supabase
          .rpc('decrement_stock', { 
            p_product_id: item.product_id, 
            p_quantity: item.quantity 
          })
        if (stockErr) {
          // RPC not available — fall back to direct UPDATE with stock check
          const currentStock = productMap.get(item.product_id)?.stock_quantity ?? 0
          if (currentStock >= item.quantity) {
            const { error: fallbackErr } = await supabase
              .from('products')
              .update({ 
                stock_quantity: currentStock - item.quantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.product_id)
              .gte('stock_quantity', item.quantity)
            if (fallbackErr) {
              console.error('Stock deduction fallback failed for product', item.product_id, fallbackErr)
            }
          } else {
            console.error('Insufficient stock for product', item.product_id, 'have', currentStock, 'need', item.quantity)
          }
        } else if (success === false) {
          console.error('Insufficient stock for product', item.product_id)
        }
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
      try {
        const { data: coup } = await supabase.from('coupons').select('used_count').eq('code', couponCode).single()
        if (coup) {
          await supabase.from('coupons').update({ used_count: (coup.used_count || 0) + 1 }).eq('code', couponCode)
        }
      } catch { /* non-critical — coupon usage reporting is best-effort */ }
    }

    logger.order('placed', order.id, { paymentMethod, total, shopId })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      totalAmount: total,
      subtotal,
      deliveryCharge,
      platformFee: financials.platformFee,
      couponDiscount,
      adminEarning: financials.adminEarning,
    })
  } catch (err) {
    logger.error('secure-place failed', {
      userId,
      shopId,
      paymentMethod,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}