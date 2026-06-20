import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/modules/authentication/services/authMiddleware'
import { createServerClient } from '@supabase/ssr'
import { checkRateLimit, getRateLimitIdentifier } from '@/modules/authentication/services/rateLimit'

// POST state-changing endpoint

const CANCELLABLE_STATUSES = ['placed', 'payment_pending', 'payment_confirmed', 'shop_accepted', 'order_packed']

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 cancellation requests per minute
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = await checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 5,
      message: 'Too many cancellation attempts. Please wait.',
    })
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    // Verify customer via cookie session
    const supabaseSsr = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: () => {},
        },
      }
    )
    const { data: { user } } = await supabaseSsr.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

    const supabase = createServiceClient()

    // Fetch the order to verify ownership + current status
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, customer_id, payment_method, payment_status')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.customer_id !== user.id) return NextResponse.json({ error: 'Not your order' }, { status: 403 })

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return NextResponse.json({
        error: `Cannot cancel order — current status is "${order.status}". Cancellation is only allowed before a delivery agent is assigned.`
      }, { status: 409 })
    }

    // Atomic update: only cancels if status is still cancellable (prevents race with agent assignment)
    const { data: updated } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
      .in('status', CANCELLABLE_STATUSES)
      .select('id, status')

    if (!updated || updated.length === 0) {
      return NextResponse.json({
        error: 'Order could not be cancelled — it may have just been assigned to a delivery agent.'
      }, { status: 409 })
    }

    await supabase.from('order_status_history').insert({
      order_id: orderId, status: 'cancelled', changed_by: user.id
    })

    // ── Refund logic for online payments ─────────────────────────────────────
    if (order.payment_method !== 'cod' && order.payment_status === 'paid') {
      try {
        // Only attempt refund if order has a Razorpay payment ID
        const { data: fullOrder } = await supabase
          .from('orders')
          .select('razorpay_payment_id')
          .eq('id', orderId)
          .single()

        if (fullOrder?.razorpay_payment_id) {
          const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
          const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET
          const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')

          const refundRes = await fetch(`https://api.razorpay.com/v1/payments/${fullOrder.razorpay_payment_id}/refund`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              notes: { order_id: orderId, reason: 'order_cancelled_by_customer' }
            }),
          })

          if (!refundRes.ok) {
            const refundErr = await refundRes.text()
            console.error(`[cancel] Razorpay refund failed for payment ${fullOrder.razorpay_payment_id}:`, refundErr)
          } else {
            const refundData = await refundRes.json()
            console.log(`[cancel] Refund initiated: ${refundData.id} for order ${orderId}`)
            // Update payment_status to refunded
            await supabase.from('orders').update({ payment_status: 'refunded' }).eq('id', orderId)
            await supabase.from('order_status_history').insert({
              order_id: orderId, status: 'refunded', changed_by: user.id,
              notes: `Refund ${refundData.id} initiated — ₹${Number(refundData.amount) / 100}`
            })
          }
        }
      } catch (refundErr) {
        console.error('[cancel] Refund exception:', refundErr)
        // Don't fail the cancellation — refund can be handled manually
      }
    }

    return NextResponse.json({ success: true, newStatus: 'cancelled' })
  } catch (err) {
    console.error('Cancel order error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
