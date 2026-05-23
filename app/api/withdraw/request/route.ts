import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/authMiddleware'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3 withdrawal requests per hour
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = await checkRateLimit(identifier, {
      windowMs: 60 * 60 * 1000,
      maxRequests: 3,
      endpoint: 'withdraw-request',
      message: 'Too many withdrawal requests. Please try again later.',
    })

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(req.headers.get('authorization')?.replace('Bearer ', '') || '')
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { user_id, user_type, amount, payment_method, upi_id, bank_account_number, bank_ifsc } = body

    if (!user_id || !user_type || !amount || !payment_method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Allowlist user_type — prevents user-controlled input from driving table selection
    const VALID_USER_TYPES = ['shopkeeper', 'delivery_agent'] as const
    type ValidUserType = typeof VALID_USER_TYPES[number]
    if (!VALID_USER_TYPES.includes(user_type as ValidUserType)) {
      return NextResponse.json({ error: 'Invalid user_type' }, { status: 400 })
    }

    // Verify the requesting user matches the user_id in body
    if (user.id !== user_id) {
      return NextResponse.json({ error: 'Cannot request withdrawal for another user' }, { status: 403 })
    }

    const serviceSupabase = createServiceClient()

    // Verify the user exists
    const { data: profile } = await serviceSupabase.from('profiles').select('id').eq('id', user_id).single()
    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check current balance
    const table = user_type === 'shopkeeper' ? 'shops' : 'delivery_agents'
    const idCol = user_type === 'shopkeeper' ? 'owner_id' : 'id'
    const { data: acct } = await serviceSupabase.from(table).select('wallet_balance').eq(idCol, user_id).single()
    const currentBalance = acct?.wallet_balance || 0

    if (amount > currentBalance) {
      return NextResponse.json({ error: `Amount ₹${amount} exceeds wallet balance ₹${currentBalance.toFixed(2)}` }, { status: 400 })
    }

    // Check for existing pending request
    const { data: existing } = await serviceSupabase
      .from('withdraw_requests')
      .select('id')
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'You already have a pending withdrawal request. Please wait for it to be processed.' }, { status: 409 })
    }

    const { data, error } = await serviceSupabase.from('withdraw_requests').insert({
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
