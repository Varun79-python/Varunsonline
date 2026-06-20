import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyAdmin } from '@/modules/authentication/services/authMiddleware'

/**
 * Admin orders list — returns orders with customer/shop/agent info
 * Uses service_role key to bypass RLS.
 * URL params: status, search, page, pageSize
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') || 'all'
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)))

    const supabase = createServiceClient()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Count query
    let countQuery = supabase.from('orders').select('id', { count: 'exact', head: true })
    if (statusFilter !== 'all') countQuery = countQuery.eq('status', statusFilter)
    const { count } = await countQuery

    // Data query with joins
    let dataQuery = supabase
      .from('orders')
      .select(`
        id, order_number, status, total_amount, admin_earning, created_at,
        customer_id, shop_id, agent_id, payment_method, subtotal,
        delivery_charge, platform_fee, shopkeeper_earning, agent_earning,
        shops!inner(name, city),
        customer:profiles!customer_id(full_name, phone)
      `)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (statusFilter !== 'all') dataQuery = dataQuery.eq('status', statusFilter)

    const { data: orders, error } = await dataQuery

    if (error) {
      console.error('Orders fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // If search term is provided, filter client-side (order_number or shop name)
    let filtered = orders || []
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(o =>
        (o as any).order_number?.toLowerCase().includes(q) ||
        (o as any).shops?.name?.toLowerCase().includes(q)
      )
    }

    return NextResponse.json({
      orders: filtered,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    })
  } catch (err) {
    console.error('Orders API error:', err)
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
  }
}
