import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { pushToUser } from '@/lib/pushHelper'
import { processEarnings } from '@/app/api/delivery/utils'

export const dynamic = 'force-dynamic'

/**
 * Razorpay Webhook Handler
 * Configure in Razorpay Dashboard → Webhooks → https://yourdomain.com/api/webhooks/razorpay
 * Events to enable: payment.captured
 * Webhook Secret: set RAZORPAY_WEBHOOK_SECRET in .env.local
 *
 * Handles:
 *   - notes.type === 'subscription'    → Shop subscription payment + activation/renewal
 *   - notes.type === 'order'           → Online order payment confirmation
 *   - notes.type === 'cod_qr'          → COD QR payment at delivery (instant verify)
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

      // ─────────────────────────────────────────────────────────────
      // A) Handle subscription payment (new + renewal)
      // ─────────────────────────────────────────────────────────────
      if (notes.type === 'subscription' && notes.shopId && notes.planId) {
        const { shopId, planId } = notes
        const razorpay_payment_id = payment.id
        const razorpay_order_id = payment.order_id

        // Fetch plan details
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('name, plan_type, fee_percent, monthly_fee, duration_days, price')
          .eq('id', planId)
          .single()
        if (!plan) {
          console.error('Plan not found:', planId)
          return NextResponse.json({ received: true })
        }

        const now = new Date()
        const durationDays = plan.duration_days || 30
        const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

        // Idempotency: check if payment already processed
        const { data: existingPayment } = await supabase
          .from('subscription_payments')
          .select('id')
          .eq('razorpay_payment_id', razorpay_payment_id)
          .maybeSingle()
        if (existingPayment) {
          console.log('Subscription payment already processed, skipping:', razorpay_payment_id)
          return NextResponse.json({ received: true })
        }

        // Check for existing active subscription → RENEWAL (extend expiry)
        const { data: activeSub } = await supabase
          .from('shop_subscriptions')
          .select('id, end_date')
          .eq('shop_id', shopId)
          .eq('is_active', true)
          .maybeSingle()

        let newStartDate: Date
        let newEndDate: Date

        if (activeSub && activeSub.end_date) {
          // RENEWAL: extend from current expiry date
          const currentEnd = new Date(activeSub.end_date)
          const nowMs = now.getTime()
          const endMs = currentEnd.getTime()

          // If current end date is in the future, start new subscription from there
          newStartDate = endMs > nowMs ? currentEnd : now
          newEndDate = new Date(newStartDate.getTime() + durationDays * 24 * 60 * 60 * 1000)
        } else {
          // NEW subscription
          newStartDate = now
          newEndDate = expiresAt
        }

        // Deactivate old subscriptions
        await supabase
          .from('shop_subscriptions')
          .update({ is_active: false })
          .eq('shop_id', shopId)
          .eq('is_active', true)

        // Create new subscription
        const { data: newSub } = await supabase
          .from('shop_subscriptions')
          .insert({
            shop_id: shopId,
            plan_id: planId,
            razorpay_order_id,
            razorpay_payment_id,
            payment_status: 'paid',
            start_date: newStartDate.toISOString(),
            end_date: newEndDate.toISOString(),
            amount_paid: payment.amount / 100,
            is_active: true,
            is_free_plan: false,
          })
          .select('id')
          .single()

        // Record in subscription_payments
        await supabase.from('subscription_payments').insert({
          shop_id: shopId,
          plan_id: planId,
          subscription_id: newSub?.id || null,
          amount: payment.amount / 100,
          razorpay_order_id,
          razorpay_payment_id,
          payment_status: 'paid',
          payment_method: 'razorpay',
          is_free_plan: false,
          verified_at: now.toISOString(),
        })

        // Activate shop
        await supabase.from('shops').update({
          is_active: true,
          is_approved: true,
          subscription_end_date: newEndDate.toISOString(),
        }).eq('id', shopId)

        const renewMsg = activeSub ? 'renewed' : 'activated'
        console.log(`Subscription ${renewMsg} for shop ${shopId} via webhook, expires ${newEndDate.toISOString()}`)

        // Notify shopkeeper
        try {
          const { data: shop } = await supabase
            .from('shops')
            .select('owner_id, name')
            .eq('id', shopId)
            .single()
          if (shop) {
            await pushToUser(
              supabase,
              shop.owner_id,
              activeSub ? '🔄 Subscription Renewed!' : '✅ Subscription Active!',
              activeSub
                ? `Your ${plan.name || 'subscription'} for ${shop.name} is renewed until ${newEndDate.toLocaleDateString('en-IN')}`
                : `Your ${plan.name || 'subscription'} for ${shop.name} is active until ${newEndDate.toLocaleDateString('en-IN')}`,
              { type: 'subscription_active', role: 'shopkeeper', shopId }
            )
          }
        } catch (pushErr) {
          console.error('[FCM] Subscription push error (non-fatal):', pushErr)
        }
      }

      // ─────────────────────────────────────────────────────────────
      // B) Handle order payment (online checkout)
      // ─────────────────────────────────────────────────────────────
      if (notes.type === 'order' && notes.orderId) {
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

          await supabase.from('order_status_history').insert({
            order_id: notes.orderId,
            status: 'payment_confirmed',
            changed_by: 'system',
          })

          console.log(`Order ${notes.orderId} payment confirmed via webhook`)
        } else {
          console.log(`Order ${notes.orderId} payment already processed (status != pending), skipping`)
          return NextResponse.json({ received: true })
        }

        // FCM push to shopkeeper
        try {
          if (order?.shops) {
            const shop = order.shops as unknown as { owner_id: string }
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

      // ─────────────────────────────────────────────────────────────
      // C) Handle COD QR payment at delivery
      // ─────────────────────────────────────────────────────────────
      if (notes.type === 'cod_qr' && notes.orderId) {
        const { data: order } = await supabase
          .from('orders')
          .select('id, payment_status, status, total_amount, order_number, agent_id, delivery_charge, agent_earning')
          .eq('id', notes.orderId)
          .eq('payment_status', 'cod_qr_pending')
          .single()

        if (order) {
          // Mark payment as confirmed
          await supabase.from('orders').update({
            status: 'delivered',
            payment_status: 'cod_qr_verified',
            razorpay_payment_id: payment.id,
            razorpay_order_id: payment.order_id,
            delivered_at: new Date().toISOString(),
            payment_confirmed_at: new Date().toISOString(),
          }).eq('id', notes.orderId)

          await supabase.from('order_status_history').insert({
            order_id: notes.orderId,
            status: 'delivered',
            changed_by: 'system',
            notes: 'COD QR payment verified via webhook'
          })

          // Credit shop + agent earnings (QR: customer paid platform, no COD settlement)
          // processEarnings handles auto-recovery from COD dues
          await processEarnings(supabase, notes.orderId)

          // Record wallet transaction for QR payment
          await supabase.from('wallet_transactions').insert({
            user_id: order.agent_id,
            user_type: 'delivery_agent',
            type: 'info',
            amount: order.total_amount,
            description: `QR payment collected for order ${order.order_number} (customer → platform)`,
            order_id: notes.orderId
          })

          console.log(`COD QR payment verified for order ${notes.orderId}, delivered`)

          // FCM push to shopkeeper
          try {
            const { data: orderWithShop } = await supabase
              .from('orders')
              .select('shops:shop_id(owner_id), customer_id')
              .eq('id', notes.orderId)
              .single()
            if (orderWithShop) {
              const shop = orderWithShop.shops as unknown as { owner_id: string }
              await pushToUser(
                supabase,
                shop.owner_id,
                '📦 Order Delivered!',
                `Order ${order.order_number} delivered successfully (QR payment)`,
                { type: 'order_delivered', role: 'shopkeeper', orderId: notes.orderId }
              )
            }
          } catch (pushErr) {
            console.error('[FCM] Delivery push error (non-fatal):', pushErr)
          }
        } else {
          console.log(`COD QR order ${notes.orderId} not found or already processed, skipping`)
          return NextResponse.json({ received: true })
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
