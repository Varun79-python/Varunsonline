import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/modules/authentication/services/authMiddleware'

export const dynamic = 'force-dynamic'

function makeUserClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  )
}

/**
 * Validate that a user is a legitimate participant in an order.
 * Participants: the customer, the shop owner, the assigned delivery agent, or an admin.
 */
async function validateParticipant(
  svc: ReturnType<typeof createServiceClient>,
  userId: string,
  orderId: string
): Promise<{ allowed: boolean; role: string }> {
  const { data: profile } = await svc
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const role = profile?.role || ''

  // Admins always allowed
  if (role === 'admin') return { allowed: true, role }

  const { data: order } = await svc
    .from('orders')
    .select('customer_id, agent_id, shop_id')
    .eq('id', orderId)
    .single()

  if (!order) return { allowed: false, role }

  // Customer — must be the order owner
  if (role === 'customer') return { allowed: order.customer_id === userId, role }

  // Delivery agent — must be assigned to this order
  if (role === 'delivery_agent') return { allowed: order.agent_id === userId, role }

  // Shopkeeper — must own the shop that this order is for
  if (role === 'shopkeeper') {
    const { data: shop } = await svc
      .from('shops')
      .select('id')
      .eq('owner_id', userId)
      .eq('id', order.shop_id)
      .maybeSingle()
    return { allowed: !!shop, role }
  }

  return { allowed: false, role }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = makeUserClient(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

    // Validate participant
    const { allowed } = await validateParticipant(svc, user.id, orderId)
    if (!allowed) return NextResponse.json({ error: 'Not a participant in this order' }, { status: 403 })

    const { data: conv } = await svc
      .from('order_conversations')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle()

    if (!conv) return NextResponse.json({ messages: [], conversationId: null })

    const { data: messages } = await svc
      .from('order_messages')
      .select('*, profiles(full_name, role, avatar_url)')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({ messages: messages || [], conversationId: conv.id })
  } catch (err) {
    console.error('Failed to fetch messages:', err)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = makeUserClient(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const body = await req.json()
    const { orderId, message } = body

    if (!orderId || !message?.trim()) {
      return NextResponse.json({ error: 'orderId and message required' }, { status: 400 })
    }

    // Validate participant
    const { allowed, role } = await validateParticipant(svc, user.id, orderId)
    if (!allowed) return NextResponse.json({ error: 'Not a participant in this order' }, { status: 403 })

    let convId: string | null = null

    const { data: existingConv } = await svc
      .from('order_conversations')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle()

    if (existingConv) {
      convId = existingConv.id
    } else {
      const { data: newConv, error: convErr } = await svc
        .from('order_conversations')
        .insert({ order_id: orderId })
        .select('id')
        .single()

      if (convErr || !newConv) return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      convId = newConv.id
    }

    const { data: newMessage, error: msgErr } = await svc
      .from('order_messages')
      .insert({
        conversation_id: convId,
        sender_id: user.id,
        sender_role: role,
        message: message.trim(),
      })
      .select('*, profiles(full_name, role, avatar_url)')
      .single()

    if (msgErr || !newMessage) return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })

    // Update conversation timestamp
    await svc
      .from('order_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId)

    return NextResponse.json({ message: newMessage, conversationId: convId })
  } catch (err) {
    console.error('Failed to send message:', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}