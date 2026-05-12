import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyShopkeeper } from '@/lib/authMiddleware'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyShopkeeper(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, shopId, durationDays } = await req.json()

    // Verify the shop belongs to this shopkeeper
    if (shopId !== auth.shopId) {
      return NextResponse.json({ error: 'Not authorized for this shop' }, { status: 403 })
    }

    // Verify Razorpay signature
    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!).update(body).digest('hex')
    if (expectedSig !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const now = new Date()
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

    // Deactivate any existing active subscriptions for this shop
    await supabase.from('shop_subscriptions').update({ is_active: false }).eq('shop_id', shopId).eq('is_active', true)

    // Create new active subscription
    await supabase.from('shop_subscriptions').insert({
      shop_id: shopId,
      plan_id: planId,
      razorpay_order_id,
      razorpay_payment_id,
      payment_status: 'paid',
      starts_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      is_active: true
    })

    // Activate shop + set expiry
    await supabase.from('shops').update({
      is_active: true,
      subscription_plan_id: planId,
      subscription_expires_at: expiresAt.toISOString(),
      subscription_fee_percent: 0 // fixed plan = no per-order fee
    }).eq('id', shopId)

    return NextResponse.json({ success: true, expiresAt: expiresAt.toISOString() })
  } catch (err) {
    console.error('Verify subscription error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
