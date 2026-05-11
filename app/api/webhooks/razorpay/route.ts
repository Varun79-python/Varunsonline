import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * Razorpay Webhook Handler
 * Configure in Razorpay Dashboard → Webhooks → https://yourdomain.com/api/webhooks/razorpay
 * Events to enable: payment.captured
 * Webhook Secret: set RAZORPAY_WEBHOOK_SECRET in .env.local
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature') || ''

    // Verify webhook authenticity
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || ''
    if (webhookSecret) {
      const expectedSig = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex')
      if (expectedSig !== signature) {
        console.error('Razorpay webhook signature mismatch')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const event = JSON.parse(body)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity
      const notes = payment?.notes || {}

      // Handle subscription payment
      if (notes.type === 'subscription' && notes.shopId && notes.planId) {
        const { shopId, planId } = notes
        const razorpay_payment_id = payment.id
        const razorpay_order_id = payment.order_id

        // Fetch plan duration
        const { data: plan } = await supabase.from('subscription_plans').select('duration_days, fee_percent').eq('id', planId).single()
        if (!plan) { console.error('Plan not found:', planId); return NextResponse.json({ ok: true }) }

        const now = new Date()
        const expiresAt = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000)

        // Check if subscription already activated (idempotency)
        const { data: existing } = await supabase.from('shop_subscriptions').select('id').eq('razorpay_payment_id', razorpay_payment_id).maybeSingle()
        if (existing) {
          console.log('Subscription already activated, skipping:', razorpay_payment_id)
          return NextResponse.json({ ok: true })
        }

        // Deactivate old subscriptions
        await supabase.from('shop_subscriptions').update({ is_active: false }).eq('shop_id', shopId).eq('is_active', true)

        // Create new subscription
        await supabase.from('shop_subscriptions').insert({
          shop_id: shopId, plan_id: planId,
          razorpay_order_id, razorpay_payment_id,
          payment_status: 'paid',
          starts_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          is_active: true
        })

        // Activate shop
        await supabase.from('shops').update({
          is_active: true,
          subscription_plan_id: planId,
          subscription_expires_at: expiresAt.toISOString(),
          subscription_fee_percent: plan.fee_percent || 0
        }).eq('id', shopId)

        console.log(`✅ Subscription auto-activated for shop ${shopId} via webhook`)
      }

      // Handle order payment (mark order as payment_confirmed)
      if (notes.type === 'order' && notes.orderId) {
        await supabase.from('orders').update({
          payment_status: 'paid',
          status: 'payment_confirmed',
          razorpay_payment_id: payment.id,
          razorpay_order_id: payment.order_id
        }).eq('id', notes.orderId).eq('payment_status', 'pending')

        console.log(`✅ Order ${notes.orderId} payment confirmed via webhook`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
