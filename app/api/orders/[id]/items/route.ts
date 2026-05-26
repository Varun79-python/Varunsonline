/**
 * app/api/orders/[id]/items/route.ts
 * PATCH — customer edits order items (add/remove/update qty) before pickup.
 * GET   — fetch current order items (for realtime refresh).
 *
 * SECURITY:
 *  - Never trusts frontend prices — fetches all prices from DB
 *  - Validates product exists, belongs to same shop, is_available, stock
 *  - Recalculates ALL financial fields server-side
 *  - Blocks editing after picked_up
 *  - Sends shopkeeper notification entry
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/authMiddleware'
import { recalcOrder, loadPlatformSettings } from '@/lib/order-calculations'

export const dynamic = 'force-dynamic'

const EDITABLE_STATUSES = new Set([
  'placed', 'payment_pending', 'payment_confirmed',
  'shop_accepted', 'order_packed', 'agent_assigned',
])

function makeUserClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  )
}

interface CartItem {
  product_id: string
  quantity: number
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = makeUserClient(req)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: orderId } = await context.params
  const svc = createServiceClient()

  const { data: items } = await svc
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ items: items ?? [] })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = makeUserClient(req)
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: orderId } = await context.params
    const body = await req.json() as { items: CartItem[] }
    const { items: cartInput } = body

    if (!Array.isArray(cartInput) || cartInput.length === 0) {
      return NextResponse.json({ error: 'At least one item required' }, { status: 400 })
    }

    const svc = createServiceClient()

    // ── 1. Load and validate the order ────────────────────────────────────────
    const { data: order } = await svc
      .from('orders')
      .select('id, status, customer_id, shop_id, delivery_charge, discount_amount')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if ((order.customer_id as string) !== user.id) {
      return NextResponse.json({ error: 'Not your order' }, { status: 403 })
    }
    if (!EDITABLE_STATUSES.has(order.status as string)) {
      return NextResponse.json({
        error: `Cannot edit order in status "${order.status}". Editing is blocked after pickup.`,
        blocked: true,
      }, { status: 409 })
    }

    // ── 2. Fetch products from DB — never trust frontend prices ───────────────
    const productIds = cartInput.map(i => i.product_id)
    const { data: products, error: prodErr } = await svc
      .from('products')
      .select('id, name, price, stock_quantity, is_available, shop_id')
      .in('id', productIds)

    if (prodErr || !products?.length) {
      return NextResponse.json({ error: 'Products not found' }, { status: 400 })
    }

    const productMap = new Map(products.map(p => [p.id as string, p]))

    // ── 3. Validate each item ──────────────────────────────────────────────────
    const validatedItems: {
      product_id: string; product_name: string; quantity: number;
      unit_price: number; total_price: number;
    }[] = []

    let subtotal = 0
    for (const cartItem of cartInput) {
      if (!cartItem.product_id || cartItem.quantity < 1) {
        return NextResponse.json({ error: 'Invalid item — quantity must be ≥ 1' }, { status: 400 })
      }

      const product = productMap.get(cartItem.product_id)
      if (!product) {
        return NextResponse.json({ error: `Product ${cartItem.product_id} not found` }, { status: 400 })
      }
      if ((product.shop_id as string) !== (order.shop_id as string)) {
        return NextResponse.json({ error: `Product "${product.name}" does not belong to this shop` }, { status: 400 })
      }
      if (!product.is_available) {
        return NextResponse.json({ error: `"${product.name}" is no longer available` }, { status: 400 })
      }
      if ((product.stock_quantity as number) < cartItem.quantity) {
        return NextResponse.json({
          error: `Insufficient stock for "${product.name}". Available: ${product.stock_quantity}`,
        }, { status: 400 })
      }

      const lineTotal = parseFloat(((product.price as number) * cartItem.quantity).toFixed(2))
      subtotal += lineTotal
      validatedItems.push({
        product_id: cartItem.product_id,
        product_name: product.name as string,
        quantity: cartItem.quantity,
        unit_price: product.price as number,
        total_price: lineTotal,
      })
    }

    // ── 4. Recalculate financials server-side ─────────────────────────────────
    const settings = await loadPlatformSettings()
    const financials = recalcOrder(
      subtotal,
      (order.delivery_charge as number) ?? 0,
      settings.platformFeePercent,
      (order.discount_amount as number) ?? 0,
    )

    // ── 5. Safe transactional save: save old items, delete, insert, rollback on failure ──
    // Step A: save old items for rollback
    const { data: oldItems } = await svc
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)

    // Step B: delete old items
    const { error: deleteErr } = await svc
      .from('order_items')
      .delete()
      .eq('order_id', orderId)
    if (deleteErr) {
      console.error('[items PATCH] delete error:', deleteErr)
      return NextResponse.json({ error: 'Failed to update items (delete)' }, { status: 500 })
    }

    // Step C: insert new validated items
    const { error: insertErr } = await svc
      .from('order_items')
      .insert(validatedItems.map(item => ({ ...item, order_id: orderId })))
    if (insertErr) {
      console.error('[items PATCH] insert error, restoring old items:', insertErr)
      // Rollback: restore old items
      if (oldItems && oldItems.length > 0) {
        await svc.from('order_items').insert(oldItems)
      }
      return NextResponse.json({ error: 'Failed to update items' }, { status: 500 })
    }

    // Step C: update order financials + items_updated_at
    const now = new Date().toISOString()
    const { error: orderUpdateErr } = await svc
      .from('orders')
      .update({
        subtotal: financials.subtotal,
        total_amount: financials.totalAmount,
        platform_fee: financials.platformFee,
        shopkeeper_earning: financials.shopkeeperEarning,
        agent_earning: financials.agentEarning,
        admin_earning: financials.adminEarning,
        items_updated_at: now,
      })
      .eq('id', orderId)
    if (orderUpdateErr) {
      console.error('[items PATCH] order update error:', orderUpdateErr)
      return NextResponse.json({ error: 'Failed to update order totals' }, { status: 500 })
    }

    // ── 6. Create shopkeeper notification ─────────────────────────────────────
    // Get shop owner id
    const { data: shopRow } = await svc
      .from('shops')
      .select('owner_id')
      .eq('id', order.shop_id as string)
      .single()

    if (shopRow?.owner_id) {
      await svc.from('notifications').insert({
        user_id: shopRow.owner_id,
        type: 'order_items_updated',
        title: 'Customer updated order items',
        message: `Items were changed on order. New total: ₹${financials.totalAmount}`,
        order_id: orderId,
        is_read: false,
      }).maybeSingle()
    }

    // ── 7. Audit log ──────────────────────────────────────────────────────────
    await svc.from('order_status_history').insert({
      order_id: orderId,
      status: 'items_updated',
      changed_by: user.id,
      note: `Customer updated items. New subtotal: ₹${financials.subtotal}`,
    }).maybeSingle()

    return NextResponse.json({
      success: true,
      items: validatedItems,
      financials,
    })
  } catch (err) {
    console.error('[items PATCH] unexpected error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
