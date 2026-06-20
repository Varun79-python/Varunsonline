/**
 * GET /api/admin/shop-detail/[id]
 *
 * Returns EVERYTHING about a shop: shop info, owner profile,
 * orders, products with ratings, subscription plan, and financials.
 * Uses service_role key (bypasses RLS).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/modules/infrastructure/supabase/server'

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
    const { id: shopId } = await params
    const authHeader = _req.headers.get('authorization')
    if (!(await verifyAdmin(authHeader))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createAdminClient()

    // ── Shop ──
    const { data: shop, error: shopErr } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .maybeSingle()

    if (shopErr) return NextResponse.json({ error: shopErr.message }, { status: 500 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    // ── Owner profile ──
    const { data: owner } = await supabase
      .from('profiles')
      .select('id, full_name, phone, email, created_at')
      .eq('id', shop.owner_id)
      .maybeSingle()

    // ── Products with ratings ──
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })

    // Fetch ratings for each product
    let productRatings: Record<string, { avg: number; count: number }> = {}
    if (products && products.length > 0) {
      const productIds = products.map(p => p.id)
      const { data: ratings } = await supabase
        .from('product_ratings')
        .select('product_id, rating')
        .in('product_id', productIds)
      
      if (ratings) {
        const groups: Record<string, number[]> = {}
        ratings.forEach(r => {
          if (!groups[r.product_id]) groups[r.product_id] = []
          groups[r.product_id].push(r.rating)
        })
        Object.entries(groups).forEach(([pid, vals]) => {
          productRatings[pid] = {
            avg: vals.reduce((a, b) => a + b, 0) / vals.length,
            count: vals.length
          }
        })
      }
    }

    // ── Orders ──
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, status, total_amount, subtotal, delivery_charge, platform_fee, admin_earning, shopkeeper_earning, agent_earning, payment_method, created_at, payment_confirmed_at, delivered_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(50)

    const orderCounts = {
      total: orders?.length || 0,
      delivered: orders?.filter(o => o.status === 'delivered').length || 0,
      cancelled: orders?.filter(o => o.status === 'cancelled' || o.status === 'rejected').length || 0,
      pending: orders?.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status)).length || 0,
    }
    const totalRevenue = (orders || [])
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.admin_earning || 0), 0)
    const totalShopEarnings = (orders || [])
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.shopkeeper_earning || 0), 0)

    // ── Subscription ──
    const { data: subscription } = await supabase
      .from('shop_subscriptions')
      .select('id, plan_id, status, start_date, end_date, auto_renew, created_at')
      .eq('shop_id', shopId)
      .maybeSingle()

    let planInfo = null
    if (subscription?.plan_id) {
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('name, price, duration_days, features')
        .eq('id', subscription.plan_id)
        .maybeSingle()
      planInfo = plan
    }

    // ── Subscription payments ──
    const { data: subPayments } = await supabase
      .from('subscription_payments')
      .select('id, amount_paid, payment_method, status, created_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      shop,
      owner,
      products: products?.map(p => ({
        ...p,
        rating: productRatings[p.id]?.avg || 0,
        rating_count: productRatings[p.id]?.count || 0,
      })) || [],
      orders: orders || [],
      orderCounts,
      totalRevenue,
      totalShopEarnings,
      subscription: subscription ? { ...subscription, plan: planInfo } : null,
      subPayments: subPayments || [],
    })
  } catch (err) {
    console.error('Shop detail error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
