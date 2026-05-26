/**
 * POST /api/notifications/order-placed
 *
 * Called by Supabase Database Webhook (orders table INSERT)
 * or by the payment confirmation API route after payment_confirmed.
 *
 * Sends a push notification to the shop owner (shopkeeper).
 *
 * Supabase Webhook setup:
 *   Table: orders
 *   Event: INSERT
 *   Method: POST
 *   URL: https://www.varunsonline.com/api/notifications/order-placed
 *   Headers: { "x-webhook-secret": "<your CRON_SECRET value>" }
 *
 * Payload sent by Supabase: { type, table, schema, record, old_record }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushToUser } from '@/lib/pushHelper'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Validate webhook secret
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await req.json()
    // Support both Supabase webhook format and direct calls
    const order = payload.record || payload

    if (!order?.id || !order?.shop_id) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Only notify on placed or payment_confirmed (ignore draft/pending status rows)
    if (order.status && order.status !== 'payment_confirmed' && order.status !== 'placed') {
      return NextResponse.json({ skipped: 'not payable status' })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get shop owner ID + name
    const { data: shop } = await supabase
      .from('shops')
      .select('owner_id, name')
      .eq('id', order.shop_id)
      .single()

    if (!shop?.owner_id) {
      return NextResponse.json({ skipped: 'shop owner not found' })
    }

    // Get customer name from profiles
    let customerName = 'a customer'
    if (order.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', order.user_id)
        .single()
      if (profile?.full_name) customerName = profile.full_name
    }

    const orderNumber = order.order_number || order.id.slice(0, 8).toUpperCase()

    await pushToUser(
      supabase,
      shop.owner_id,
      '🛒 New Order Received!',
      `Order ${orderNumber} from ${customerName} — ₹${order.total_amount || ''}. Tap to Accept/Reject.`,
      {
        type: 'new_order',
        role: 'shopkeeper',
        orderId: order.id,
        orderNumber,
      },
      'varunsonline_orders'
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[FCM] order-placed webhook error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
