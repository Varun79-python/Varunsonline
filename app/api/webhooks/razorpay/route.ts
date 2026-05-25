import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { pushToUser } from '@/lib/pushHelper'

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

    // Webhook secret is mandatory — reject if not configured
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('[WEBHOOK] RAZORPAY_WEBHOOK_SECRET is not set. Rejecting request to prevent unsigned webhook processing.')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    // Always verify Razorpay HMAC signature — no bypass path
    const expectedSig = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex')
    if (expectedSig !== signature) {
      console.error('[WEBHOOK] Signature mismatch — possible forged request rejected.')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
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

        // Fetch plan duration based on plan_type
        const { data: plan } = await supabase.from('subscription_plans').select('plan_type, fee_percent, monthly_fee, duration_days').eq('id', planId).single()
        if (!plan) { console.error('Plan not found:', planId); return NextResponse.json({ received: true }) }

        const now = new Date()
        const durationDays = plan.duration_days || 30
        const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

        // Check if subscription already activated (idempotency)
        const { data: existing } = await supabase.from('shop_subscriptions').select('id').eq('razorpay_payment_id', razorpay_payment_id).maybeSingle()
        if (existing) {
          console.log('Subscription already activated, skipping:', razorpay_payment_id)
          return NextResponse.json({ received: true })
        }

        // Deactivate old subscriptions
        await supabase.from('shop_subscriptions').update({ is_active: false }).eq('shop_id', shopId).eq('is_active', true)

        // Create new subscription (columns: start_date, end_date per schema)
        await supabase.from('shop_subscriptions').insert({
          shop_id: shopId, plan_id: planId,
          razorpay_order_id, razorpay_payment_id,
          payment_status: 'paid',
          start_date: now.toISOString(),
          end_date: expiresAt.toISOString(),
          amount_paid: payment.amount / 100,
          is_active: true
        })

        // Activate shop
        await supabase.from('shops').update({
          is_active: true,
          is_approved: true,
        }).eq('id', shopId)

        console.log(`Subscription auto-activated for shop ${shopId} via webhook`)
      }

      // Handle order payment (mark order as payment_confirmed)
      if (notes.type === 'order' && notes.orderId) {
        // secure-place creates order with status='payment_pending' and payment_status='pending' for online payments
        // Webhook confirms the payment - only update if still pending (idempotent)
        const { data: order } = await supabase
          .from('orders')
          .select('id, payment_status, customer_id, total_amount, order_number, shops:shop_id(owner_id)')
          .eq('id', notes.orderId)
          .eq('payment_status', 'pending')
          .single()

        if (order) {
          await supabase.from('orders').update({
            status: 'payment_confirmed',
            payment_status: 'paid',
            razorpay_payment_id: payment.id,
            razorpay_order_id: payment.order_id
          }).eq('id', notes.orderId).eq('payment_status', 'pending')

          // Record status history
          await supabase.from('order_status_history').insert({
            order_id: notes.orderId,
            status: 'payment_confirmed',
            changed_by: 'system',
          }).maybeSingle()

          console.log(`Order ${notes.orderId} payment confirmed via webhook`)
        } else {
          console.log(`Order ${notes.orderId} payment already processed (status != pending), skipping`)
          return NextResponse.json({ received: true })
        }

        // FCM push to shopkeeper
        try {
          if (order?.shops) {
            const shop = order.shops as unknown as { owner_id: string; name: string }
            const { data: prof } = await supabase
              .from('profiles').select('full_name').eq('id', order.customer_id).maybeSingle()
            const customerName = prof?.full_name || 'a customer'
            const orderNum = order.order_number || notes.orderId.slice(0, 8).toUpperCase()
            await pushToUser(
              supabase,
              shop.owner_id,
              '🛒 Payment Confirmed!',
              `Order ${orderNum} from ${customerName} — ₹${order.total_amount || ''}. Prepare for dispatch.`,
              { type: 'payment_confirmed', role: 'shopkeeper', orderId: notes.orderId, orderNumber: orderNum },
              'varunsonline_orders'
            )
          }
        } catch (pushErr) {
          console.error('[FCM] Shopkeeper push error (non-fatal):', pushErr)
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
