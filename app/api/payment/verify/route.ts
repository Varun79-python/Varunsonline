import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface VerifyPaymentPayload {
  razorpay_order_id?: string
  razorpay_payment_id?: string
  razorpay_signature?: string
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
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload

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

  logger.payment('verify_success', { razorpay_order_id, razorpay_payment_id })
  return NextResponse.json({ verified: true })
}
