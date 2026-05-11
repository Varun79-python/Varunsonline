/**
 * lib/pushHelper.ts
 *
 * Server-only helper — fetches device tokens from DB and sends FCM.
 * Call this directly from any API route instead of HTTP-calling
 * /api/notifications/send to avoid unnecessary round-trips.
 */
import { SupabaseClient } from '@supabase/supabase-js'
import { sendFcmToMany } from './fcm'

export async function pushToUser(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  channelId = 'varunsonline_orders'
): Promise<void> {
  try {
    const { data: rows } = await supabase
      .from('device_tokens')
      .select('token')
      .eq('user_id', userId)

    const tokens = (rows || []).map((r: { token: string }) => r.token).filter(Boolean)
    if (tokens.length === 0) return

    await sendFcmToMany(tokens, title, body, data, channelId)
  } catch (e) {
    // Push failure must NEVER break the order flow
    console.error('[FCM] pushToUser error:', e)
  }
}
