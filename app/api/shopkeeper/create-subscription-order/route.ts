import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { planId, shopId, amount } = await req.json()
    if (!planId || !shopId || !amount) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!
    })

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      notes: { planId, shopId, type: 'subscription' }
    })

    return NextResponse.json({ orderId: order.id, key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID })
  } catch (err) {
    console.error('Create subscription order error:', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
