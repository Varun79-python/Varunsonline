import { NextRequest, NextResponse } from 'next/server'

// Force dynamic — never statically evaluated at build time
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Payment gateway is not configured' }, { status: 500 })
    }

    const { amount } = await req.json()
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Dynamic import avoids Razorpay SDK running at build time
    const Razorpay = (await import('razorpay')).default

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `vo_${Date.now()}`,
    })

    return NextResponse.json(order)
  } catch (err) {
    console.error('Razorpay error:', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
