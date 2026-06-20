/**
 * GET /api/admin/shop-detail?id=<shop_id>
 *
 * Returns full shop details + orders from that shop.
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

export async function GET(req: NextRequest) {
  try {
    if (!(await verifyAdmin(req.headers.get('authorization')))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const shopId = searchParams.get('id')
    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch shop details
    const { data: shop, error: shopErr } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .maybeSingle()

    if (shopErr) return NextResponse.json({ error: shopErr.message }, { status: 500 })
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    // Fetch profile info for the shop owner
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('full_name, phone, email, created_at')
      .eq('id', shop.owner_id)
      .maybeSingle()

    // Fetch orders from this shop (bypasses RLS via admin client)
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, order_number, status, total_amount, admin_earning, shopkeeper_earning, payment_method, created_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 })

    // Count orders by status
    const orderCounts = {
      total: orders?.length || 0,
      delivered: orders?.filter(o => o.status === 'delivered').length || 0,
      cancelled: orders?.filter(o => o.status === 'cancelled' || o.status === 'rejected').length || 0,
      pending: orders?.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status)).length || 0,
    }

    // Calculate revenue
    const totalRevenue = (orders || [])
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.admin_earning || 0), 0)

    return NextResponse.json({
      shop,
      owner: ownerProfile || null,
      orders: orders || [],
      orderCounts,
      totalRevenue,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
