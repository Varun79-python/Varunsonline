import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agentId')
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch active order for this agent
    const { data: order } = await supabase
      .from('orders')
      .select('id, order_number, status, agent_earning, total_amount, delivery_charge, created_at, shop_id, address_id, payment_method')
      .eq('agent_id', agentId)
      .in('status', ['agent_assigned', 'picked_up', 'out_for_delivery'])
      .maybeSingle()

    if (!order) return NextResponse.json({ order: null })

    // Fetch shop, address, and order items in parallel (all bypass RLS)
    const [shopRes, addrRes, itemsRes] = await Promise.all([
      supabase.from('shops').select('name, address_line1, city, latitude, longitude').eq('id', order.shop_id).single(),
      supabase.from('addresses').select('house_name, street_name, landmark, city, latitude, longitude, phone').eq('id', order.address_id).single(),
      supabase.from('order_items').select('id, product_name, quantity, unit_price, total_price, product_image_url').eq('order_id', order.id)
    ])

    const shop = shopRes.data
    const address = addrRes.data
    const items = itemsRes.data || []

    // Auto-calculate distance between shop and customer
    let distanceKm: number | null = null
    if (shop?.latitude && shop?.longitude && address?.latitude && address?.longitude) {
      distanceKm = parseFloat(getDistanceKm(shop.latitude, shop.longitude, address.latitude, address.longitude).toFixed(1))
    }

    return NextResponse.json({
      order: {
        ...order,
        shop,
        address,
        items,
        distanceKm
      }
    })
  } catch (err) {
    console.error('Active order fetch error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
