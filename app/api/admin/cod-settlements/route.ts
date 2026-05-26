import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/authMiddleware'
import { verifyAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

/**
 * Admin API for COD Settlement Management
 * GET  → list all COD settlement entries with agent info
 * POST → manually settle a COD due (admin marks partial/full payment)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req)
    if (auth.error || !auth.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 })
    }

    const supabase = createServiceClient()

    const url = new URL(req.url)
    const agentId = url.searchParams.get('agent_id')
    const status = url.searchParams.get('status') // pending, partially_paid, settled, overdue

    let query = supabase
      .from('agent_cod_settlement_ledger')
      .select('*, delivery_agents!agent_id(full_name, phone, wallet_balance, pending_cod_due), orders!order_id(order_number, total_amount, created_at)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (agentId) query = query.eq('agent_id', agentId)
    if (status) query = query.eq('status', status)

    const { data: entries, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Also get summary stats
    const { data: summary } = await supabase
      .from('agent_cod_settlement_ledger')
      .select('status, amount_owed_to_platform, settled_amount, pending_amount')

    const totalOwed = (summary || []).reduce((s, e) => s + Number(e.amount_owed_to_platform || 0), 0)
    const totalPending = (summary || []).reduce((s, e) => s + Number(e.pending_amount || 0), 0)
    const totalSettled = (summary || []).reduce((s, e) => s + Number(e.settled_amount || 0), 0)

    return NextResponse.json({
      entries: entries || [],
      summary: {
        totalOwed,
        totalPending,
        totalSettled,
        pendingCount: (summary || []).filter(e => e.status === 'pending').length,
        partiallyPaidCount: (summary || []).filter(e => e.status === 'partially_paid').length,
        settledCount: (summary || []).filter(e => e.status === 'settled').length,
      }
    })
  } catch (err) {
    console.error('COD settlements error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/cod-settlements
 * Admin marks a manual COD settlement (partial or full)
 * Body: { ledgerId, settleAmount, notes }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req)
    if (auth.error || !auth.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const userId = auth.userId!

    const { ledgerId, settleAmount, notes } = await req.json()
    if (!ledgerId || !settleAmount || settleAmount <= 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // Use the manual_cod_settlement DB function
    const { data, error } = await supabase.rpc('manual_cod_settlement', {
      p_ledger_id: ledgerId,
      p_settle_amount: settleAmount,
      p_admin_id: userId,
      p_notes: notes || ''
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Get updated ledger entry
    const { data: updated } = await supabase
      .from('agent_cod_settlement_ledger')
      .select('*, orders!order_id(order_number)')
      .eq('id', ledgerId)
      .single()

    return NextResponse.json({
      success: true,
      message: `✅ Settlement of ₹${settleAmount} recorded`,
      entry: updated
    })
  } catch (err) {
    console.error('Manual settlement error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
