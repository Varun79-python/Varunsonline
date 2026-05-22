import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/authMiddleware'

export const dynamic = 'force-dynamic'

// Statuses where item editing is allowed (before physical pickup)
const EDITABLE_STATUSES = [
  'placed', 'payment_pending', 'payment_confirmed',
  'shop_accepted', 'order_packed', 'agent_assigned'
]

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

interface ItemUpdate {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
}

// PATCH /api/orders/[id]/items — update items and recalculate all financial fields
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = makeUserClient(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: orderId } = await context.params
    const { items }: { items: ItemUpdate[] } = await req.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array required (min 1 item)' }, { status: 400 })
    }

    const svc = createServiceClient()

    // Verify order belongs to this customer and is still editable
    const { data: order } = await svc
      .from('orders')
      .select('id, status, customer_id, shop_id, delivery_charge')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.customer_id !== user.id) return NextResponse.json({ error: 'Not your order' }, { status: 403 })
    if (!EDITABLE_STATUSES.includes(order.status)) {
      return NextResponse.json({
        error: `Cannot edit order — current status is "${order.status}". Editing blocked after agent picks up.`
      }, { status: 409 })
    }

    // Fetch shop subscription fee
    const { data: shop } = await svc
      .from('shops')
      .select('subscription_fee_percent')
      .eq('id', order.shop_id)
      .single()

    const feePercent = (shop?.subscription_fee_percent as number) || 0

    // Recalculate financials
    const subtotal = parseFloat(items.reduce((sum, item) =>
      sum + item.unit_price * item.quantity, 0).toFixed(2))

    const deliveryCharge = (order.delivery_charge as number) || 0
    const platformFee = parseFloat((subtotal * 0.02).toFixed(2))
    const shopFeeDeduction = parseFloat((subtotal * feePercent / 100).toFixed(2))
    const shopkeeperEarning = parseFloat((subtotal - shopFeeDeduction).toFixed(2))
    const adminEarning = parseFloat((platformFee + shopFeeDeduction).toFixed(2))
    const totalAmount = parseFloat((subtotal + deliveryCharge + platformFee).toFixed(2))

    // Atomically replace items
    await svc.from('order_items').delete().eq('order_id', orderId)

    const { error: insertErr } = await svc.from('order_items').insert(
      items.map(item => ({
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: parseFloat((item.unit_price * item.quantity).toFixed(2)),
      }))
    )
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    // Update order financials + signal shopkeeper via items_updated_at
    const { error: updateErr } = await svc
      .from('orders')
      .update({
        subtotal,
        total_amount: totalAmount,
        platform_fee: platformFee,
        shopkeeper_earning: shopkeeperEarning,
        admin_earning: adminEarning,
        items_updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Audit log
    await svc.from('order_status_history').insert({
      order_id: orderId,
      status: 'items_updated',
      changed_by: user.id,
    }).maybeSingle()

    return NextResponse.json({
      success: true,
      subtotal,
      total_amount: totalAmount,
      platform_fee: platformFee,
      shopkeeper_earning: shopkeeperEarning,
      admin_earning: adminEarning,
    })
  } catch (err) {
    console.error('Order items update error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// GET /api/orders/[id]/items
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = makeUserClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: orderId } = await context.params
  const svc = createServiceClient()

  const { data: items } = await svc
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ items: items || [] })
}
