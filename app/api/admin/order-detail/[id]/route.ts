import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, verifyAdmin } from '@/lib/authMiddleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await verifyAdmin(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServiceClient()

    const [
      { data: order },
      { data: items },
    ] = await Promise.all([
      supabase.from('orders').select('*, shops(name, phone, address_line1, city, latitude, longitude)').eq('id', id).single(),
      supabase.from('order_items').select('*').eq('order_id', id),
    ])

    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Fetch customer profile
    let customer = null
    if (order.customer_id) {
      const { data: c } = await supabase.from('profiles').select('full_name, phone, email').eq('id', order.customer_id).single()
      customer = c
    }

    // Fetch delivery address
    let address = null
    if (order.address_id) {
      const { data: a } = await supabase.from('addresses').select('*').eq('id', order.address_id).single()
      address = a
    }

    // Fetch delivery agent
    let agent = null
    if (order.agent_id) {
      const { data: ag } = await supabase.from('delivery_agents').select('full_name, phone, vehicle_type, vehicle_number').eq('id', order.agent_id).single()
      agent = ag
    }

    return NextResponse.json({ order, items: items || [], customer, address, agent })
  } catch (err) {
    console.error('Order detail error:', err)
    return NextResponse.json({ error: 'Failed to load order details' }, { status: 500 })
  }
}
