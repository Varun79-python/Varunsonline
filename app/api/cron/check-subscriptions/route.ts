import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Auto-Deactivate Expired Subscriptions
 * 
 * Called by Vercel Cron (see vercel.json) every day at midnight.
 * Also callable manually: GET /api/cron/check-subscriptions
 * 
 * Secure with CRON_SECRET env variable.
 * Set in Vercel: CRON_SECRET=your-random-secret-string
 */
export async function GET(req: NextRequest) {
  // CRON_SECRET is mandatory — reject if not configured
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET is not set. Rejecting request to prevent unauthenticated cron execution.')
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 })
  }

  // Always verify the Authorization header — no bypass path
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error('[CRON] Authorization header missing or invalid — request rejected.')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date().toISOString()

  // 1. Find all expired active subscriptions (fixed_monthly only — percentage never expires)
  const { data: expiredSubs, error: fetchErr } = await supabase
    .from('shop_subscriptions')
    .select('id, shop_id, plan_id, end_date, subscription_plans(plan_type)')
    .eq('is_active', true)
    .not('end_date', 'is', null)
    .lt('end_date', now)

  if (fetchErr) {
    console.error('Cron: fetch expired subs error:', fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!expiredSubs || expiredSubs.length === 0) {
    return NextResponse.json({ message: 'No expired subscriptions found', deactivated: 0 })
  }

  let deactivated = 0
  const shopIds: string[] = []

  for (const sub of expiredSubs) {
    // Deactivate the subscription record
    await supabase
      .from('shop_subscriptions')
      .update({ is_active: false })
      .eq('id', sub.id)

    shopIds.push(sub.shop_id)
    deactivated++
  }

  // 2. Deactivate the shops (set is_active = false)
  if (shopIds.length > 0) {
    await supabase
      .from('shops')
      .update({
        is_active: false,
        subscription_plan_id: null,
        subscription_fee_percent: 0
      })
      .in('id', shopIds)

    console.log(`Cron: Deactivated ${deactivated} expired subscriptions for shops:`, shopIds)
  }

  return NextResponse.json({
    message: `Deactivated ${deactivated} expired subscription(s)`,
    deactivated,
    shopIds
  })
}
