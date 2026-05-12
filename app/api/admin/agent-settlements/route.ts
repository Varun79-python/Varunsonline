import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/agent-settlements
 * Returns all settlement-type wallet transactions for delivery agents,
 * joined with agent info, sorted by most recent.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agentId') // optional filter

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch settlement transactions
    let query = supabase
      .from('wallet_transactions')
      .select('*')
      .eq('type', 'settlement')
      .eq('user_type', 'delivery_agent')
      .order('created_at', { ascending: false })
      .limit(200)

    if (agentId) query = query.eq('user_id', agentId)

    const { data: txns, error: txnErr } = await query
    if (txnErr) return NextResponse.json({ error: txnErr.message }, { status: 500 })

    // Fetch all agents for name mapping
    const { data: agents } = await supabase
      .from('delivery_agents')
      .select('id, full_name, phone, wallet_balance')

    const agentMap: Record<string, { full_name: string; phone: string; wallet_balance: number }> = {}
    for (const a of agents || []) agentMap[a.id] = a

    // Enrich transactions with agent info
    type RawTxn = Record<string, unknown>
    const enriched: RawTxn[] = (txns || []).map((t: RawTxn) => ({
      ...t,
      agent_name: agentMap[t.user_id as string]?.full_name || 'Unknown',
      agent_phone: agentMap[t.user_id as string]?.phone || '—',
    }))

    // Summary stats per agent
    const agentStats: Record<string, {
      id: string; name: string; phone: string; wallet_balance: number
      total_settled: number; settlement_count: number; last_settled_at: string | null
    }> = {}

    for (const t of enriched) {
      const uid = t.user_id as string
      if (!agentStats[uid]) {
        agentStats[uid] = {
          id: uid,
          name: t.agent_name as string,
          phone: t.agent_phone as string,
          wallet_balance: agentMap[uid]?.wallet_balance || 0,
          total_settled: 0,
          settlement_count: 0,
          last_settled_at: null
        }
      }
      agentStats[uid].total_settled += Number(t.amount) || 0
      agentStats[uid].settlement_count += 1
      if (!agentStats[uid].last_settled_at) agentStats[uid].last_settled_at = t.created_at as string
    }

    // Also fetch agents with pending balance (wallet < 0) who haven't settled
    const pendingAgents = (agents || []).filter(a => a.wallet_balance < 0)

    return NextResponse.json({
      transactions: enriched,
      agentStats: Object.values(agentStats),
      pendingAgents
    })
  } catch (err) {
    console.error('Admin agent settlements error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
