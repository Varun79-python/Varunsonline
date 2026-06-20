/**
 * GET /api/admin/agent-detail?id=<agent_id>
 *
 * Returns full delivery agent details + orders delivered by that agent.
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
    const agentId = searchParams.get('id')
    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch agent details
    const { data: agent, error: agentErr } = await supabase
      .from('delivery_agents')
      .select('*')
      .eq('id', agentId)
      .maybeSingle()

    if (agentErr) return NextResponse.json({ error: agentErr.message }, { status: 500 })
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    // Fetch profile info for the agent (name, phone, email, etc.)
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, email, created_at')
      .eq('id', agentId)
      .maybeSingle()

    // Fetch orders delivered by this agent (bypasses RLS via admin client)
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, order_number, status, total_amount, admin_earning, agent_earning, payment_method, created_at, shop_id')
      .eq('agent_id', agentId)
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

    // Calculate earnings
    const totalEarnings = (orders || [])
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.agent_earning || 0), 0)

    return NextResponse.json({
      agent,
      profile: profile || null,
      orders: orders || [],
      orderCounts,
      totalEarnings,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
