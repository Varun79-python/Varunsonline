/**
 * GET /api/admin/customer-detail/[id]
 *
 * Returns EVERYTHING about a customer: profile, addresses,
 * orders with items, shop names, delivery addresses, and total spend.
 * Uses service_role key (bypasses RLS).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

async function verifyAdmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.substring(7))
  if (!user) return false
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL
  return profile?.role === 'admin' || (!!ADMIN_EMAIL && (profile?.email === ADMIN_EMAIL || user.email === ADMIN_EMAIL))
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params
    const authHeader = _req.headers.get('authorization')
    if (!(await verifyAdmin(authHeader))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createAdminClient()

    // ── Customer profile ──
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', customerId)
      .maybeSingle()

    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })
    if (!profile) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    // ── Addresses ──
    const { data: addresses } = await supabase
      .from('addresses')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    // ── Orders with shop names and items ──
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, status, total_amount, subtotal, delivery_charge, platform_fee, discount_amount, admin_earning, shopkeeper_earning, agent_earning, payment_method, payment_status, address_id, shop_id, created_at, delivered_at, placed_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(50)

    // Fetch items for each order
    let orderItemsMap: Record<string, any[]> = {}
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id)
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)

      if (items) {
        items.forEach(item => {
          if (!orderItemsMap[item.order_id]) orderItemsMap[item.order_id] = []
          orderItemsMap[item.order_id].push(item)
        })
      }
    }

    // Fetch delivery addresses for each order
    const addressIds = orders?.map(o => o.address_id).filter(Boolean) || []
    let addressMap: Record<string, any> = {}
    if (addressIds.length > 0) {
      const uniqueIds = [...new Set(addressIds)]
      const { data: addrRows } = await supabase
        .from('addresses')
        .select('*')
        .in('id', uniqueIds)

      if (addrRows) {
        addrRows.forEach(a => { addressMap[a.id] = a })
      }
    }

    // Fetch shop names
    const shopIds = orders?.map(o => o.shop_id).filter(Boolean) || []
    let shopNameMap: Record<string, string> = {}
    if (shopIds.length > 0) {
      const uniqueShopIds = [...new Set(shopIds)]
      const { data: shopRows } = await supabase
        .from('shops')
        .select('id, name')
        .in('id', uniqueShopIds)

      if (shopRows) {
        shopRows.forEach(s => { shopNameMap[s.id] = s.name })
      }
    }

    const orderCounts = {
      total: orders?.length || 0,
      delivered: orders?.filter(o => o.status === 'delivered').length || 0,
      cancelled: orders?.filter(o => o.status === 'cancelled' || o.status === 'rejected').length || 0,
      pending: orders?.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status)).length || 0,
    }

    const totalSpent = (orders || [])
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total_amount || 0), 0)

    // Format orders for response
    const formattedOrders = (orders || []).map(o => ({
      ...o,
      shop_name: shopNameMap[o.shop_id] || 'Unknown',
      items: orderItemsMap[o.id] || [],
      delivery_address: addressMap[o.address_id] || null,
    }))

    return NextResponse.json({
      profile,
      addresses: addresses || [],
      orders: formattedOrders,
      orderCounts,
      totalSpent,
    })
  } catch (err) {
    console.error('Customer detail error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
