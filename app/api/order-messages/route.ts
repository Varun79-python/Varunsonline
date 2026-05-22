import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/authMiddleware'

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

export async function GET(req: NextRequest) {
  const supabase = makeUserClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()

  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get('orderId')
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const { data: conv } = await serviceClient
    .from('order_conversations')
    .select('id')
    .eq('order_id', orderId)
    .single()

  if (!conv) return NextResponse.json({ messages: [], conversationId: null })

  const { data: messages } = await serviceClient
    .from('order_messages')
    .select('*, profiles(full_name, role, avatar_url)')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: messages || [], conversationId: conv.id })
}

export async function POST(req: NextRequest) {
  const supabase = makeUserClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()
  const body = await req.json()
  const { orderId, message } = body
  if (!orderId || !message?.trim()) {
    return NextResponse.json({ error: 'orderId and message required' }, { status: 400 })
  }

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  let convId: string | null = null

  const { data: existingConv } = await serviceClient
    .from('order_conversations')
    .select('id')
    .eq('order_id', orderId)
    .single()

  if (existingConv) {
    convId = existingConv.id
  } else {
    const { data: newConv, error: convErr } = await serviceClient
      .from('order_conversations')
      .insert({ order_id: orderId })
      .select('id')
      .single()

    if (convErr || !newConv) return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    convId = newConv.id
  }

  const { data: newMessage, error: msgErr } = await serviceClient
    .from('order_messages')
    .insert({
      conversation_id: convId,
      sender_id: user.id,
      sender_role: profile.role,
      message: message.trim()
    })
    .select('*, profiles(full_name, role, avatar_url)')
    .single()

  if (msgErr || !newMessage) return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })

  await serviceClient
    .from('order_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', convId)

  return NextResponse.json({ message: newMessage, conversationId: convId })
}