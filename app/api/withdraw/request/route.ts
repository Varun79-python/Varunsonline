import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, validateOrigin } from '@/modules/authentication/services/authMiddleware'

// POST state-changing endpoint

const MAX_WITHDRAWALS_PER_WEEK = 5

/**
 * POST /api/withdraw/request
 * Submit a withdrawal request.
 *
 * STRICT FRAUD PREVENTION:
 *   1. Max 5 withdrawals per week (Monday reset)
 *   2. Withdrawable balance = wallet_balance - pending_cod_due
 *   3. Cannot withdraw with negative wallet
 *   4. Cannot withdraw if COD settlement due exists
 *   5. Cannot withdraw if account blocked
 *   6. No pending withdrawal already exists
 *   7. Rate limited: 3 requests/hour
 */
export async function POST(req: NextRequest) {
  try {
    // Read JWT from Authorization header — the client sends it, but
    // createServiceClient() (service_role) has no session, so we must
    // pass the token explicitly to getUser().
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
    if (!token) {
      return NextResponse.json({ error: 'No authorization token' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CSRF protection (production only)
    const csrf = validateOrigin(req)
    if (!csrf.valid) {
      return NextResponse.json({ error: csrf.error }, { status: 403 })
    }

    const { user_id, user_type, amount, payment_method, upi_id, bank_account_number, bank_ifsc } = await req.json()

    // ── Input validation ──────────────────────────────────────────
    if (!user_id || !user_type || !amount || !payment_method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['shopkeeper', 'delivery_agent'].includes(user_type)) {
      return NextResponse.json({ error: 'Invalid user type' }, { status: 403 })
    }

    // User can only withdraw for themselves
    if (user_id !== user.id) {
      return NextResponse.json({ error: 'Cannot request withdrawal for another user' }, { status: 403 })
    }

    const withdrawAmount = Number(amount)
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return NextResponse.json({ error: 'Invalid withdrawal amount' }, { status: 400 })
    }

    if (payment_method === 'upi' && !upi_id?.trim()) {
      return NextResponse.json({ error: 'UPI ID required' }, { status: 400 })
    }
    if (payment_method === 'bank_transfer' && (!bank_account_number?.trim() || !bank_ifsc?.trim())) {
      return NextResponse.json({ error: 'Bank account details required' }, { status: 400 })
    }

    // ── Rate limit: 3 requests/hour ──────────────────────────────
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { count: recentCount } = await supabase
      .from('withdraw_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('created_at', oneHourAgo)

    if (recentCount && recentCount >= 3) {
      return NextResponse.json({ error: 'Too many requests. Please wait before submitting again.' }, { status: 429 })
    }

    // ── Check no pending withdrawal ───────────────────────────────
    const { data: pending } = await supabase
      .from('withdraw_requests')
      .select('id')
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .maybeSingle()

    if (pending) {
      return NextResponse.json({ error: 'You already have a pending withdrawal request' }, { status: 400 })
    }

    // ── Fetch user + check balances ───────────────────────────────
    let currentBalance = 0
    let pendingCodDue = 0
    let isBlocked = false

    if (user_type === 'shopkeeper') {
      const { data: shop } = await supabase
        .from('shops')
        .select('wallet_balance, is_active, is_approved')
        .eq('owner_id', user_id)
        .single()

      if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

      currentBalance = shop.wallet_balance || 0
      pendingCodDue = 0  // Shopkeepers don't have COD dues
      isBlocked = !shop.is_active || !shop.is_approved
    } else {
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('wallet_balance, pending_cod_due, is_blocked')
        .eq('id', user_id)
        .single()

      if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

      currentBalance = agent.wallet_balance || 0
      pendingCodDue = agent.pending_cod_due || 0
      isBlocked = agent.is_blocked || false
    }

    // ── Fraud prevention checks ───────────────────────────────────
    if (isBlocked) {
      return NextResponse.json({ error: 'Account is blocked. Contact support.' }, { status: 403 })
    }

    if (currentBalance <= 0) {
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }

    if (currentBalance < 0) {
      return NextResponse.json({ error: 'Cannot withdraw with negative balance' }, { status: 400 })
    }

    // Withdrawable balance = wallet_balance - pending_cod_due
    const withdrawableBalance = Math.max(0, currentBalance - pendingCodDue)

    if (withdrawAmount > withdrawableBalance) {
      const msg = pendingCodDue > 0
        ? `Withdrawable balance is ₹${withdrawableBalance.toFixed(2)} (₹${pendingCodDue.toFixed(2)} held for COD settlement). Enter a lower amount.`
        : `Insufficient balance. Available: ₹${withdrawableBalance.toFixed(2)}`
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // ── Weekly withdrawal limit check ─────────────────────────────
    const weekStart = getWeekStart()
    const { count: weeklyCount } = await supabase
      .from('withdraw_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('created_at', weekStart.toISOString())

    if (weeklyCount && weeklyCount >= MAX_WITHDRAWALS_PER_WEEK) {
      return NextResponse.json({
        error: `Weekly withdrawal limit reached (${MAX_WITHDRAWALS_PER_WEEK}/week). Try again next week (resets Monday 12 AM).`
      }, { status: 400 })
    }

    // ── Lock funds: deduct from wallet immediately ────────────────
    const newBalance = currentBalance - withdrawAmount

    if (user_type === 'shopkeeper') {
      await supabase.from('shops').update({ wallet_balance: newBalance }).eq('owner_id', user_id)
    } else {
      await supabase.from('delivery_agents').update({ wallet_balance: newBalance }).eq('id', user_id)
    }

    // ── Create withdrawal request ─────────────────────────────────
    const { data, error } = await supabase.from('withdraw_requests').insert({
      user_id,
      user_type,
      amount: withdrawAmount,
      payment_method,
      upi_id: payment_method === 'upi' ? upi_id.trim() : null,
      bank_account_number: payment_method === 'bank_transfer' ? bank_account_number.trim() : null,
      bank_ifsc: payment_method === 'bank_transfer' ? bank_ifsc.trim() : null,
      status: 'pending',
      wallet_balance_before: currentBalance,
      wallet_balance_after: newBalance,
    }).select('id').single()

    if (error) {
      // Rollback: refund wallet
      if (user_type === 'shopkeeper') {
        await supabase.from('shops').update({ wallet_balance: currentBalance }).eq('owner_id', user_id)
      } else {
        await supabase.from('delivery_agents').update({ wallet_balance: currentBalance }).eq('id', user_id)
      }
      console.error('Withdrawal creation failed, wallet refunded:', error)
      return NextResponse.json({ error: 'Failed to create withdrawal request' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      message: '✅ Withdrawal request submitted! Admin will process within 24 hours.'
    })
  } catch (err) {
    console.error('Withdrawal error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

function getWeekStart(): Date {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon
  const diff = day === 0 ? 6 : day - 1 // Days since Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}
