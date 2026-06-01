/**
 * GET /api/admin/agent-detail/[id]
 *
 * Returns EVERYTHING about a delivery agent: profile info,
 * documents, orders delivered, and performance stats.
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
    const { id: agentId } = await params
    const authHeader = _req.headers.get('authorization')
    if (!(await verifyAdmin(authHeader))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createAdminClient()

    // ── Agent profile ──
    const { data: agent, error: agentErr } = await supabase
      .from('delivery_agents')
      .select('*')
      .eq('id', agentId)
      .maybeSingle()

    if (agentErr) return NextResponse.json({ error: agentErr.message }, { status: 500 })
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    // ── Profile (for full_name fallback) ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, phone, email, created_at')
      .eq('id', agentId)
      .maybeSingle()

    // ── Orders delivered by this agent ──
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, status, total_amount, subtotal, delivery_charge, platform_fee, admin_earning, shopkeeper_earning, agent_earning, payment_method, created_at, payment_confirmed_at, delivered_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(50)

    const orderCounts = {
      total: orders?.length || 0,
      delivered: orders?.filter(o => o.status === 'delivered').length || 0,
      cancelled: orders?.filter(o => o.status === 'cancelled' || o.status === 'rejected').length || 0,
      pending: orders?.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status)).length || 0,
    }
    const totalEarnings = (orders || [])
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.agent_earning || 0), 0)

    return NextResponse.json({
      agent,
      profile,
      orders: orders || [],
      orderCounts,
      totalEarnings,
    })
  } catch (err) {
    console.error('Agent detail error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
