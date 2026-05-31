import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/authMiddleware'
import { recalcOrder } from '@/lib/order-calculations'
import { haversineKm } from '@/lib/gps'

// POST state-changing endpoint

// Simple in-memory rate limiter: max 5 orders per customer per minute
const orderCounters = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(customerId: string): boolean {
  const now = Date.now()
  const entry = orderCounters.get(customerId)
  if (!entry || now > entry.resetAt) {
    orderCounters.set(customerId, { count: 1, resetAt: now + 60000 })
    return true
  }
  if (entry.count >= 5) return false
  entry.count++
  return true
}

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
      couponCode
    } = body

    if (!customerId || !shopId || !addressId || !cart?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // CRITICAL: Verify the requesting user owns this customerId
    if (user.id !== customerId) {
      return NextResponse.json({ error: 'Cannot place order for another user' }, { status: 403 })
    }

    // Rate limiting
    if (!checkRateLimit(customerId)) {
      return NextResponse.json({ error: 'Too many orders. Please wait before placing another.' }, { status: 429 })
    }

    // Verify user has a customer profile
    const serviceSupabase = createServiceClient()
    const { data: profile } = await serviceSupabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!profile || profile.role !== 'customer') {
      return NextResponse.json({ error: 'Only customers can place orders' }, { status: 403 })
    }

    // Verify address belongs to customer
    const { data: address } = await serviceSupabase.from('addresses').select('customer_id, latitude, longitude').eq('id', addressId).single()
    if (!address || address.customer_id !== customerId) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }

    // Verify shop exists, is approved, and is active
    const { data: shop } = await serviceSupabase.from('shops').select('id, latitude, longitude, is_active, is_approved, subscription_end_date').eq('id', shopId).single()
    if (!shop || !shop.is_active || !shop.is_approved) {
      return NextResponse.json({ error: 'Shop not available' }, { status: 400 })
    }

    // Verify shop subscription is valid
    if (shop.subscription_end_date && new Date(shop.subscription_end_date) < new Date()) {
      return NextResponse.json({ error: 'Shop subscription has expired. Cannot place order.' }, { status: 400 })
    }

    // ── SERVER-SIDE DELIVERY RADIUS CHECK ──────────────────────────────────
    // Verify the delivery address is within the shop's delivery radius
    const { data: radiusSetting } = await serviceSupabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'shop_radius_km')
      .maybeSingle()
    const shopRadiusKm = radiusSetting ? Number(radiusSetting.value) : 10

    if (address.latitude && address.longitude && shop.latitude && shop.longitude) {
      const distance = haversineKm(address.latitude, address.longitude, shop.latitude, shop.longitude)
      if (distance > shopRadiusKm) {
        console.warn(`[COD Blocked] Shop ${shopId} is ${distance.toFixed(1)}km from address ${addressId}, radius is ${shopRadiusKm}km`)
        return NextResponse.json({
          error: 'This shop does not currently deliver to your saved address.'
        }, { status: 400 })
      }
    }

    // ── SERVER-SIDE RECALCULATION (never trust client financials) ──────────────

    // Fetch product prices & stock from DB to verify subtotal and for stock deduction
    const productIds = cart.map((i: { product_id: string }) => i.product_id)
    const { data: products } = await serviceSupabase
      .from('products')
      .select('id, name, price, stock_quantity')
      .in('id', productIds)
      .eq('is_available', true)

    const productMap = new Map((products || []).map(p => [p.id, p]))
    let serverSubtotal = 0
    for (const item of cart) {
      const product = productMap.get(item.product_id)
      if (!product) {
        return NextResponse.json({ error: `Product ${item.product_id} not found` }, { status: 400 })
      }
      serverSubtotal += product.price * item.quantity
    }

    // Load platform settings for delivery charge & fee percent
    const { data: settings } = await serviceSupabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['base_delivery_charge', 'per_km_delivery_charge', 'platform_fee_percent'])

    const settingsMap = new Map((settings || []).map(s => [s.key, s.value]))
    const baseDeliveryCharge = parseFloat(settingsMap.get('base_delivery_charge') || '30')
    const perKmCharge = parseFloat(settingsMap.get('per_km_delivery_charge') || '5')
    const platformFeePercent = parseFloat(settingsMap.get('platform_fee_percent') || '5')

    // Calculate delivery charge based on distance (if coordinates available)
    let serverDeliveryCharge = baseDeliveryCharge
    if (address.latitude && address.longitude && shop.latitude && shop.longitude) {
      const distance = haversineKm(address.latitude, address.longitude, shop.latitude, shop.longitude)
      serverDeliveryCharge = baseDeliveryCharge + Math.ceil(distance) * perKmCharge
    }

    // Validate coupon (if any) — use couponDiscount = 0 if not provided in body
    const clientCouponDiscount = body.couponDiscount || 0
    const clientCouponCode = body.couponCode || null
    let serverCouponDiscount = 0
    if (clientCouponDiscount > 0 && clientCouponCode) {
      const { data: coupon } = await serviceSupabase
        .from('coupons')
        .select('discount_type, discount_value, min_order_amount, max_discount, usage_limit, used_count, is_active, valid_until')
        .eq('code', clientCouponCode)
        .single()

      if (coupon && coupon.is_active) {
        if (!coupon.valid_until || new Date(coupon.valid_until) > new Date()) {
          if (!coupon.usage_limit || coupon.used_count < coupon.usage_limit) {
            if (serverSubtotal >= (coupon.min_order_amount || 0)) {
              if (coupon.discount_type === 'percent') {
                serverCouponDiscount = Math.round((serverSubtotal * coupon.discount_value) / 100)
                if (coupon.max_discount && serverCouponDiscount > coupon.max_discount) {
                  serverCouponDiscount = coupon.max_discount
                }
              } else {
                serverCouponDiscount = coupon.discount_value
              }
            }
          }
        }
      }
    }

    // Calculate all financials using shared logic (single source of truth)
    const financials = recalcOrder(serverSubtotal, serverDeliveryCharge, platformFeePercent, serverCouponDiscount)

    // Place order with COD payment method using server-calculated values
    const { data: order, error: orderErr } = await serviceSupabase
      .from('orders')
      .insert({
        customer_id: customerId,
        shop_id: shopId,
        address_id: addressId,
        status: 'placed',
        payment_method: 'cod',
        payment_status: 'pending',
        subtotal: financials.subtotal,
        platform_fee: financials.platformFee,
        delivery_charge: serverDeliveryCharge,
        discount_amount: serverCouponDiscount,
        total_amount: financials.totalAmount,
        shopkeeper_earning: financials.shopkeeperEarning,
        agent_earning: financials.agentEarning,
        admin_earning: financials.adminEarning,
        coupon_code: serverCouponDiscount > 0 ? clientCouponCode : null,
      })
      .select()
      .single()

    if (orderErr || !order) {
      console.error('COD order error:', orderErr)
      return NextResponse.json({ error: orderErr?.message || 'Failed to create order' }, { status: 500 })
    }

    // Insert order items using server-verified prices
    const { error: itemsErr } = await serviceSupabase.from('order_items').insert(
      cart.map((i: { product_id: string; name: string; image_url: string; quantity: number; price: number }) => {
        const verifiedProduct = productMap.get(i.product_id)
        const verifiedPrice = verifiedProduct?.price || i.price
        return {
          order_id: order.id,
          product_id: i.product_id,
          product_name: i.name || verifiedProduct?.name || 'Item',
          product_image_url: i.image_url || null,
          quantity: i.quantity,
          unit_price: verifiedPrice,
          total_price: verifiedPrice * i.quantity,
        }
      })
    )
    if (itemsErr) {
      console.error('Failed to insert order items:', itemsErr)
      // Don't fail the order — items can be reconciled later
    }

    // Status history
    await serviceSupabase.from('order_status_history').insert({
      order_id: order.id, status: 'placed', changed_by: customerId
    })

    // ── Increment coupon usage count (prevents reusing limited coupons) ──────
    if (serverCouponDiscount > 0 && clientCouponCode) {
      try {
        const { error: couponErr } = await serviceSupabase
          .rpc('increment_coupon_usage', { p_code: clientCouponCode })
        if (couponErr) {
          // Fallback: direct increment
          const { data: coupon } = await serviceSupabase
            .from('coupons')
            .select('used_count')
            .eq('code', clientCouponCode)
            .single()
          if (coupon) {
            await serviceSupabase
              .from('coupons')
              .update({ used_count: (coupon.used_count || 0) + 1 })
              .eq('code', clientCouponCode)
          }
        }
      } catch (couponErr) {
        console.error('[place-cod] Failed to increment coupon usage:', couponErr)
        // Non-fatal: order already placed
      }
    }

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

    // ── Deduct stock for each item atomically ────────────────────────────────
    for (const item of cart) {
      try {
        const { data: success, error: stockErr } = await serviceSupabase
          .rpc('decrement_stock', {
            p_product_id: item.product_id,
            p_quantity: item.quantity
          })
        if (stockErr) {
          // RPC not available — fall back to direct UPDATE with stock check
          const currentStock = productMap.get(item.product_id)?.stock_quantity ?? 0
          if (currentStock >= item.quantity) {
            const { error: fallbackErr } = await serviceSupabase
              .from('products')
              .update({ 
                stock_quantity: currentStock - item.quantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.product_id)
              .gte('stock_quantity', item.quantity)
            if (fallbackErr) {
              console.error('Stock deduction failed for product', item.product_id, fallbackErr)
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

    return NextResponse.json({ success: true, orderId: order.id })
  } catch (err) {
    console.error('Place COD order error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
