/**
 * GET /api/admin/shopkeeper-detail/[id]
 *
 * Returns EVERYTHING about a shopkeeper: profile, shops,
 * documents, orders across all shops, subscriptions, and financials.
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
    const { id: shopkeeperId } = await params
    const authHeader = _req.headers.get('authorization')
    if (!(await verifyAdmin(authHeader))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createAdminClient()

    // ── Profile ──
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', shopkeeperId)
      .maybeSingle()

    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })
    if (!profile) return NextResponse.json({ error: 'Shopkeeper not found' }, { status: 404 })

    // ── Shops owned ──
    const { data: shops } = await supabase
      .from('shops')
      .select('*')
      .eq('owner_id', shopkeeperId)
      .order('created_at', { ascending: false })

    // ── Documents submitted ──
    const { data: documents } = await supabase
      .from('shop_documents')
      .select('*')
      .eq('user_id', shopkeeperId)
      .order('created_at', { ascending: false })
      .limit(5)

    // ── Orders across all shops ──
    let orders: any[] = []
    let orderCounts = { total: 0, delivered: 0, cancelled: 0, pending: 0 }
    let totalRevenue = 0
    let totalShopEarnings = 0

    if (shops && shops.length > 0) {
      const shopIds = shops.map(s => s.id)
      const { data: fetchedOrders } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, subtotal, delivery_charge, platform_fee, admin_earning, shopkeeper_earning, agent_earning, payment_method, payment_status, shop_id, created_at, delivered_at')
        .in('shop_id', shopIds)
        .order('created_at', { ascending: false })
        .limit(50)

      orders = fetchedOrders || []
      orderCounts = {
        total: orders.length,
        delivered: orders.filter(o => o.status === 'delivered').length,
        cancelled: orders.filter(o => o.status === 'cancelled' || o.status === 'rejected').length,
        pending: orders.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status)).length,
      }
      totalRevenue = orders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + (o.admin_earning || 0), 0)
      totalShopEarnings = orders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + (o.shopkeeper_earning || 0), 0)
    }

    // ── Subscriptions ──
    let subscriptions: any[] = []
    let subPayments: any[] = []
    if (shops && shops.length > 0) {
      const shopIds = shops.map(s => s.id)
      const { data: subs } = await supabase
        .from('shop_subscriptions')
        .select('*, subscription_plans!inner(name, price, duration_days, features)')
        .in('shop_id', shopIds)
        .order('created_at', { ascending: false })
        .limit(10)

      subscriptions = subs || []

      // Fetch payment history for these subscriptions
      const subIds = subscriptions.map(s => s.id)
      if (subIds.length > 0) {
        const { data: payments } = await supabase
          .from('subscription_payments')
          .select('*')
          .in('subscription_id', subIds)
          .order('created_at', { ascending: false })
          .limit(20)

        subPayments = payments || []
      }
    }

    // Map shop name to orders
    const shopNameMap: Record<string, string> = {}
    if (shops) shops.forEach(s => { shopNameMap[s.id] = s.name })

    const formattedOrders = orders.map(o => ({
      ...o,
      shop_name: shopNameMap[o.shop_id] || 'Unknown',
    }))

    return NextResponse.json({
      profile,
      shops: shops || [],
      documents: documents || [],
      orders: formattedOrders,
      orderCounts,
      totalRevenue,
      totalShopEarnings,
      subscriptions,
      subPayments,
    })
  } catch (err) {
    console.error('Shopkeeper detail error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
