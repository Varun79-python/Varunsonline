import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — fetch all withdrawal requests for admin
export async function GET() {
  try {
    const supabase = admin()
    const { data, error } = await supabase
      .from('withdraw_requests')
      .select('*, profiles:user_id(full_name, email, phone)')
      .order('requested_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ withdrawals: data || [] })
  } catch (err) {
    console.error('Admin withdrawals GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — approve (paid) or reject a withdrawal request
export async function POST(req: NextRequest) {
  try {
    const { id, action, admin_note } = await req.json()
    if (!id || !action) return NextResponse.json({ error: 'Missing id or action' }, { status: 400 })
    if (!['paid', 'rejected'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    const supabase = admin()

    // Fetch the withdrawal request
    const { data: wr, error: fetchErr } = await supabase
      .from('withdraw_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !wr) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (wr.status !== 'pending') return NextResponse.json({ error: 'Request already processed' }, { status: 409 })

    // Update the withdraw request status
    const { error: updateErr } = await supabase
      .from('withdraw_requests')
      .update({
        status: action,
        processed_at: new Date().toISOString(),
        admin_note: admin_note || null,
      })
      .eq('id', id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    if (action === 'paid') {
      // Debit the wallet
      const table = wr.user_type === 'shopkeeper' ? 'shops' : 'delivery_agents'
      const idCol = wr.user_type === 'shopkeeper' ? 'owner_id' : 'id'

      const { data: acct } = await supabase.from(table).select('wallet_balance').eq(idCol, wr.user_id).single()
      const currentBalance = acct?.wallet_balance || 0
      const newBalance = Math.max(0, currentBalance - wr.amount)

      await supabase.from(table).update({ wallet_balance: newBalance }).eq(idCol, wr.user_id)

      // Record wallet transaction
      await supabase.from('wallet_transactions').insert({
        user_id: wr.user_id,
        user_type: wr.user_type,
        type: 'debit',
        amount: wr.amount,
        description: `Withdrawal paid via ${wr.payment_method === 'upi' ? `UPI (${wr.upi_id})` : `Bank Transfer`}`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin withdraw process error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
