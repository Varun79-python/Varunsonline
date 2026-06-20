import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushToUser } from '@/modules/notifications/services/pushHelper'

export const dynamic = 'force-dynamic'

/**
 * CRON: Check subscription expiry + send reminders
 * Run daily via: https://yourdomain.com/api/cron/check-subscriptions
 * Headers: Authorization: Bearer <CRON_SECRET>
 *
 * DOES:
 *   1. Deactivate expired subscriptions (end_date < now)
 *   2. Send push notifications 7/3/1 day(s) before expiry
 *   3. Send expiry day notification
 *   4. Reset weekly withdrawal counters (if Monday)
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }

    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date()
    const results: string[] = []

    // ── 1. Deactivate expired subscriptions ──────────────────────
    const { data: expired, error: fetchErr } = await supabase
      .from('shop_subscriptions')
      .select('id, shop_id, end_date')
      .eq('is_active', true)
      .not('end_date', 'is', null)
      .lt('end_date', now.toISOString())

    if (fetchErr) {
      console.error('Error fetching expired subscriptions:', fetchErr)
    } else if (expired && expired.length > 0) {
      const expiredIds = expired.map(s => s.id)
      const shopIds = [...new Set(expired.map(s => s.shop_id))]

      // Deactivate subscriptions
      const { error: deactErr } = await supabase
        .from('shop_subscriptions')
        .update({ is_active: false })
        .in('id', expiredIds)
      if (deactErr) {
        console.error('Error deactivating subscriptions:', deactErr)
      }

      // Deactivate shops
      for (const shopId of shopIds) {
        await supabase.from('shops').update({
          is_active: false,
          subscription_plan_id: null,
          subscription_fee_percent: 0,
        }).eq('id', shopId)

        // Notify shopkeeper
        const { data: shop } = await supabase
          .from('shops')
          .select('owner_id, name')
          .eq('id', shopId)
          .single()
        if (shop) {
          await pushToUser(
            supabase,
            shop.owner_id,
            '⚠️ Subscription Expired',
            `Your subscription for ${shop.name} has expired. Renew to reactivate your shop and continue receiving orders.`,
            { type: 'subscription_expired', role: 'shopkeeper', shopId }
          )
        }
      }

      results.push(`Deactivated ${expiredIds.length} expired subscriptions (${shopIds.length} shops)`)
    }

    // ── 2. Send expiry reminders ─────────────────────────────────
    const reminders = [
      { days: 7, field: 'notified_7d', label: '7 days before' },
      { days: 3, field: 'notified_3d', label: '3 days before' },
      { days: 1, field: 'notified_1d', label: '1 day before' },
    ]

    for (const reminder of reminders) {
      const targetDate = new Date(now.getTime() + reminder.days * 24 * 60 * 60 * 1000)
      const targetDateStr = targetDate.toISOString().split('T')[0]

      const { data: subs } = await supabase
        .from('shop_subscriptions')
        .select('id, shop_id, end_date')
        .eq('is_active', true)
        .not('end_date', 'is', null)
        .gte('end_date', `${targetDateStr}T00:00:00Z`)
        .lt('end_date', `${targetDateStr}T23:59:59Z`)
        .eq(reminder.field, false)
        .limit(50)

      if (subs && subs.length > 0) {
        for (const sub of subs) {
          // Update notification flag
          await supabase.from('shop_subscriptions')
            .update({ [reminder.field]: true })
            .eq('id', sub.id)

          // Notify shopkeeper
          const { data: shop } = await supabase
            .from('shops')
            .select('owner_id, name')
            .eq('id', sub.shop_id)
            .single()
          if (shop) {
            const daysLeft = reminder.days
            await pushToUser(
              supabase,
              shop.owner_id,
              daysLeft === 1 ? '⚠️ Subscription Expires Tomorrow!' : `⚠️ ${daysLeft} Days Until Expiry`,
              daysLeft === 1
                ? `Your subscription for ${shop.name} expires TOMORROW. Renew now to avoid deactivation.`
                : `Your subscription for ${shop.name} expires in ${daysLeft} days. Renew to keep your shop active.`,
              { type: 'subscription_reminder', role: 'shopkeeper', shopId: sub.shop_id }
            )
          }
        }
        results.push(`Sent ${reminder.label} reminders to ${subs.length} shops`)
      }
    }

    // ── 3. Reset weekly withdrawal counters (if Monday) ──────────
    const isMonday = now.getDay() === 1
    if (isMonday) {
      const { error: resetAgentsErr } = await supabase
        .from('delivery_agents')
        .update({ weekly_withdrawal_count: 0, last_withdrawal_reset: now.toISOString() })
        .lt('last_withdrawal_reset', getWeekStart(now).toISOString())

      const { error: resetShopsErr } = await supabase
        .from('shops')
        .update({ weekly_withdrawal_count: 0, last_withdrawal_reset: now.toISOString() })
        .lt('last_withdrawal_reset', getWeekStart(now).toISOString())

      if (!resetAgentsErr && !resetShopsErr) {
        results.push('Weekly withdrawal counters reset')
      }
    }

    return NextResponse.json({
      ok: true,
      results,
      timestamp: now.toISOString()
    })
  } catch (err) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}

function getWeekStart(now: Date): Date {
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}
