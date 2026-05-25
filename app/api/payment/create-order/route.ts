import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/authMiddleware'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

// Force dynamic — never statically evaluated at build time
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let userId: string | undefined
  let orderId: string | undefined
  let amount: number | undefined
  try {
    // Rate limit: 10 payment requests per minute
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = await checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: 'Too many payment requests. Please wait a moment.',
    })

    if (!rateCheck.allowed) {
      logger.payment('rate_limited', { identifier })
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      logger.payment('auth_failed', { reason: authError?.message })
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
    userId = user.id

    const body = await req.json()
    amount = body.amount
    orderId = body.orderId

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      logger.payment('invalid_amount', { userId, amount })
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // If orderId provided, verify ownership
    if (orderId) {
      const serviceSupabase = createServiceClient()
      const { data: order } = await serviceSupabase
        .from('orders')
        .select('customer_id, total_amount')
        .eq('id', orderId)
        .single()

      if (!order) {
        logger.payment('order_not_found', { userId, orderId })
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      // Verify user owns this order
      if (order.customer_id !== user.id) {
        logger.payment('wrong_owner', { userId, orderId, ownerId: order.customer_id })
        return NextResponse.json({ error: 'Cannot create payment for another user\'s order' }, { status: 403 })
      }

      // Verify amount matches order total (with small tolerance for rounding)
      if (Math.abs(order.total_amount - amount) > 1) {
        logger.payment('amount_mismatch', { userId, orderId, expected: order.total_amount, got: amount })
        return NextResponse.json({ error: 'Amount does not match order total' }, { status: 400 })
      }
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      logger.payment('not_configured')
      return NextResponse.json({ error: 'Payment gateway is not configured' }, { status: 500 })
    }

    // Dynamic import avoids Razorpay SDK running at build time
    const Razorpay = (await import('razorpay')).default

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: orderId ? `vo_${orderId.slice(0, 8)}` : `vo_${Date.now()}`,
      notes: orderId ? { type: 'order', orderId } : undefined,
    })

    logger.payment('order_created', { userId, orderId, razorpayOrderId: order.id, amount })
    return NextResponse.json(order)
  } catch (err) {
    logger.error('create-order failed', { userId, orderId, amount, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
