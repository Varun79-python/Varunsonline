import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyShopkeeper } from '@/lib/authMiddleware'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyShopkeeper(req)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { latitude, longitude } = await req.json()

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: 'Coordinates out of range' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('shops')
      .update({ latitude, longitude })
      .eq('id', auth.shopId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('update-location error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
