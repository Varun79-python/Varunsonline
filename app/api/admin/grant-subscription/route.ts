import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/authMiddleware'
import { verifyAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/grant-subscription
 * Admin grants a FREE subscription to a shop.
 * No Razorpay payment required.
 * Body: { shopId, planId, durationDays?, grantReason }
 *
 * grantReason can be: 'promotion','manual_approval','special_case','testing','partnership'
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req)
    if (auth.error || !auth.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 })
    }

    const userId = auth.userId!
    const supabase = createServiceClient()

    const { shopId, planId, durationDays, grantReason } = await req.json()
    if (!shopId || !planId) {
      return NextResponse.json({ error: 'shopId and planId are required' }, { status: 400 })
    }

    const validReasons = ['promotion', 'manual_approval', 'special_case', 'testing', 'partnership']
    const reason = grantReason || 'manual_approval'
    if (!validReasons.includes(reason)) {
      return NextResponse.json({ error: 'Invalid grant reason' }, { status: 400 })
    }

    // Verify shop exists
    const { data: shop } = await supabase.from('shops').select('id, name, is_active').eq('id', shopId).single()
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    // Verify plan exists
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('id, name, duration_days')
      .eq('id', planId)
      .single()
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

    const now = new Date()
    const durDays = durationDays || plan.duration_days || 30
    const expiresAt = new Date(now.getTime() + durDays * 24 * 60 * 60 * 1000)

    // Check existing active subscription for renewal
    const { data: activeSub } = await supabase
      .from('shop_subscriptions')
      .select('id, end_date')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .maybeSingle()

    let newStartDate: Date
    let newEndDate: Date

    if (activeSub && activeSub.end_date) {
      const currentEnd = new Date(activeSub.end_date)
      newStartDate = currentEnd > now ? currentEnd : now
      newEndDate = new Date(newStartDate.getTime() + durDays * 24 * 60 * 60 * 1000)
    } else {
      newStartDate = now
      newEndDate = expiresAt
    }

    // Deactivate old subscriptions
    await supabase.from('shop_subscriptions').update({ is_active: false }).eq('shop_id', shopId).eq('is_active', true)

    // Create new free subscription
    const { data: newSub } = await supabase
      .from('shop_subscriptions')
      .insert({
        shop_id: shopId,
        plan_id: planId,
        payment_status: 'paid',
        start_date: newStartDate.toISOString(),
        end_date: newEndDate.toISOString(),
        amount_paid: 0,
        is_active: true,
        is_free_plan: true,
        granted_by: userId,
        grant_reason: reason,
      })
      .select('id')
      .single()

    // Record in subscription_payments
    await supabase.from('subscription_payments').insert({
      shop_id: shopId,
      plan_id: planId,
      subscription_id: newSub?.id || null,
      amount: 0,
      payment_status: 'paid',
      payment_method: 'admin_grant',
      is_free_plan: true,
      granted_by: userId,
      grant_reason: reason,
      verified_at: now.toISOString(),
    })

    // Activate shop
    await supabase.from('shops').update({
      is_active: true,
      is_approved: true,
      subscription_end_date: newEndDate.toISOString(),
    }).eq('id', shopId)

    console.log(`Free subscription granted to shop ${shopId} by admin ${userId}, reason: ${reason}`)

    return NextResponse.json({
      success: true,
      message: `✅ Free subscription granted to ${shop.name} until ${newEndDate.toLocaleDateString('en-IN')}`,
      subscription: {
        startDate: newStartDate.toISOString(),
        endDate: newEndDate.toISOString(),
        reason,
      }
    })
  } catch (err) {
    console.error('Grant subscription error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
