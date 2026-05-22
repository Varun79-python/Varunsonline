import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/authMiddleware'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

const CANCELLABLE_STATUSES = ['placed', 'payment_pending', 'payment_confirmed', 'shop_accepted', 'order_packed']

export async function POST(req: NextRequest) {
  try {
    // Verify customer via cookie session
    const supabaseSsr = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: () => {},
        },
      }
    )
    const { data: { user } } = await supabaseSsr.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

    const supabase = createServiceClient()

    // Fetch the order to verify ownership + current status
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, customer_id, payment_method, payment_status')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.customer_id !== user.id) return NextResponse.json({ error: 'Not your order' }, { status: 403 })

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return NextResponse.json({
        error: `Cannot cancel order — current status is "${order.status}". Cancellation is only allowed before a delivery agent is assigned.`
      }, { status: 409 })
    }

    // Atomic update: only cancels if status is still cancellable (prevents race with agent assignment)
    const { data: updated } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
      .in('status', CANCELLABLE_STATUSES)
      .select('id, status')

    if (!updated || updated.length === 0) {
      return NextResponse.json({
        error: 'Order could not be cancelled — it may have just been assigned to a delivery agent.'
      }, { status: 409 })
    }

    await supabase.from('order_status_history').insert({
      order_id: orderId, status: 'cancelled', changed_by: user.id
    })

    return NextResponse.json({ success: true, newStatus: 'cancelled' })
  } catch (err) {
    console.error('Cancel order error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
