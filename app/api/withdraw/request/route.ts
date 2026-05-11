import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST — create a withdrawal request (bypasses RLS using service role)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, user_type, amount, payment_method, upi_id, bank_account_number, bank_ifsc } = body

    if (!user_id || !user_type || !amount || !payment_method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = admin()

    // Verify the user exists
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user_id).single()
    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check current balance
    const table = user_type === 'shopkeeper' ? 'shops' : 'delivery_agents'
    const idCol = user_type === 'shopkeeper' ? 'owner_id' : 'id'
    const { data: acct } = await supabase.from(table).select('wallet_balance').eq(idCol, user_id).single()
    const currentBalance = acct?.wallet_balance || 0

    if (amount > currentBalance) {
      return NextResponse.json({ error: `Amount ₹${amount} exceeds wallet balance ₹${currentBalance.toFixed(2)}` }, { status: 400 })
    }

    // Check for existing pending request
    const { data: existing } = await supabase
      .from('withdraw_requests')
      .select('id')
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'You already have a pending withdrawal request. Please wait for it to be processed.' }, { status: 409 })
    }

    const { data, error } = await supabase.from('withdraw_requests').insert({
      user_id,
      user_type,
      amount,
      payment_method,
      upi_id: upi_id || null,
      bank_account_number: bank_account_number || null,
      bank_ifsc: bank_ifsc || null,
      status: 'pending',
      requested_at: new Date().toISOString(),
    }).select().single()

    if (error) {
      console.error('Withdraw insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('Withdraw request error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
