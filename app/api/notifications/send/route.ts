/**
 * POST /api/notifications/send
 * Internal-only endpoint for sending FCM push notifications.
 * Protected by CRON_SECRET to prevent public abuse.
 *
 * Body:
 * {
 *   userId: string;           // Supabase user_id to notify
 *   title: string;
 *   body: string;
 *   data?: Record<string,string>;  // passed to notification tap handler
 *   channelId?: string;
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendFcmToMany } from '@/lib/fcm'

// POST state-changing endpoint

export async function POST(req: NextRequest) {
  // Lightweight internal auth — only our own server routes call this
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { userId, title, body, data, channelId } = await req.json()
    if (!userId || !title || !body) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch all tokens for this user (may have multiple devices)
    const { data: rows } = await supabase
      .from('device_tokens')
      .select('token')
      .eq('user_id', userId)

    const tokens = (rows || []).map((r: { token: string }) => r.token).filter(Boolean)
    if (tokens.length === 0) {
      return NextResponse.json({ success: true, skipped: 'no_tokens' })
    }

    await sendFcmToMany(tokens, title, body, data, channelId)
    return NextResponse.json({ success: true, sent: tokens.length })
  } catch (err) {
    console.error('[FCM] /api/notifications/send error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
