import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

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
}
