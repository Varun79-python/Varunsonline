import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/authMiddleware'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit'

// Force dynamic — never statically evaluated at build time
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 payment requests per minute
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: 'Too many payment requests. Please wait a moment.',
    })

    if (!rateCheck.allowed) {
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
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const body = await req.json()
    const { amount, orderId } = body

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
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
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      // Verify user owns this order
      if (order.customer_id !== user.id) {
        return NextResponse.json({ error: 'Cannot create payment for another user\'s order' }, { status: 403 })
      }

      // Verify amount matches order total (with small tolerance for rounding)
      if (Math.abs(order.total_amount - amount) > 1) {
        return NextResponse.json({ error: 'Amount does not match order total' }, { status: 400 })
      }
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Payment gateway is not configured' }, { status: 500 })
    }

    // Dynamic import avoids Razorpay SDK running at build time
    const Razorpay = (await import('razorpay')).default

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: orderId ? `vo_${orderId.slice(0, 8)}` : `vo_${Date.now()}`,
    })

    return NextResponse.json(order)
  } catch (err) {
    console.error('Razorpay error:', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}