import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/modules/infrastructure/services/logger'

// POST state-changing endpoint

interface VerifyPaymentPayload {
  razorpay_order_id?: string
  razorpay_payment_id?: string
  razorpay_signature?: string
  orderId?: string
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) {
      logger.payment('verify_not_configured')
      return NextResponse.json({ error: 'Payment verification is not configured' }, { status: 500 })
    }

    const payload = await req.json() as VerifyPaymentPayload
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = payload

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    logger.payment('verify_missing_fields', { hasOrderId: !!razorpay_order_id, hasPaymentId: !!razorpay_payment_id, hasSig: !!razorpay_signature })
    return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 })
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (!safeCompare(expectedSignature, razorpay_signature)) {
    logger.payment('verify_sig_mismatch', { razorpay_order_id, razorpay_payment_id })
    return NextResponse.json({ verified: false, error: 'Invalid payment signature' }, { status: 400 })
  }

  // Update the order in the database upon successful verification
  if (orderId) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // SECURITY: Verify that the order's razorpay_order_id matches the payment
      // This prevents an attacker from using a small payment's signature
      // to fraudulently mark a different large order as paid.
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('razorpay_order_id, payment_status')
        .eq('id', orderId)
        .maybeSingle()

      if (!existingOrder) {
        logger.error('verify_order_not_found', { orderId })
        return NextResponse.json({ verified: false, error: 'Order not found' }, { status: 404 })
      }

      // If order already has a different razorpay_order_id, reject
      if (existingOrder.razorpay_order_id && existingOrder.razorpay_order_id !== razorpay_order_id) {
        logger.error('verify_order_mismatch', { orderId, existing: existingOrder.razorpay_order_id, received: razorpay_order_id })
        return NextResponse.json({ verified: false, error: 'Order does not match this payment' }, { status: 400 })
      }

      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          status: 'payment_confirmed',
          payment_status: 'paid',
          razorpay_payment_id,
          razorpay_order_id,
        })
        .eq('id', orderId)
        .eq('payment_status', 'pending') // idempotent: only update if still pending

      if (updateErr) {
        logger.error('verify_db_update_failed', { orderId, razorpay_order_id, error: updateErr.message })
      } else {
        logger.payment('verify_db_updated', { orderId, razorpay_order_id, razorpay_payment_id })

        // Record status history
        await supabase.from('order_status_history').insert({
          order_id: orderId,
          status: 'payment_confirmed',
          changed_by: 'system',
        }).maybeSingle()
      }
    } catch (dbErr) {
      logger.error('verify_db_error', { orderId, razorpay_order_id, error: String(dbErr) })
      // Non-fatal: payment was verified, but DB update failed
    }
  }

    logger.payment('verify_success', { razorpay_order_id, razorpay_payment_id, orderId })
    return NextResponse.json({ verified: true })
  } catch (err) {
    logger.error('verify_unexpected_error', { error: String(err) })
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
