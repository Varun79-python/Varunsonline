/**
 * POST /api/notifications/register-token
 * Body: { userId: string; token: string }
 *
 * Saves / updates an FCM device token for a user.
 * Upserts on (user_id, token) to handle refresh and prevent duplicates.
 * The table `device_tokens` must exist in Supabase (DDL below).
 *
 * DDL (run once in Supabase SQL editor):
 * ------------------------------------------------------------
 * create table if not exists device_tokens (
 *   id            uuid primary key default gen_random_uuid(),
 *   user_id       uuid not null,
 *   token         text not null,
 *   platform      text default 'android',
 *   created_at    timestamptz default now(),
 *   updated_at    timestamptz default now(),
 *   unique (user_id, token)
 * );
 * create index if not exists idx_device_tokens_user_id on device_tokens(user_id);
 * ------------------------------------------------------------
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId, token } = await req.json()
    if (!userId || !token) {
      return NextResponse.json({ error: 'Missing userId or token' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        { user_id: userId, token, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      )

    if (error) {
      console.error('[FCM] Token save error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[FCM] Register token error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
