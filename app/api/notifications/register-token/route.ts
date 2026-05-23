/**
 * POST /api/notifications/register-token
 * Auth: Bearer token (Supabase session JWT) required in Authorization header
 * Body: { token: string }
 *
 * Saves / updates an FCM device token for the authenticated user.
 * The user ID is extracted from the verified auth session — any userId
 * in the request body is IGNORED to prevent IDOR attacks.
 *
 * Security: the server verifies the caller's identity via their Supabase
 * JWT before writing. An attacker cannot register a token for another
 * user even if they know that user's UUID.
 *
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
    // 1. Verify caller's identity — reject if no valid JWT
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const jwt = authHeader.substring(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    // 2. Extract token from body (userId from body is IGNORED — enforced server-side)
    const { token } = await req.json()
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // 3. Register the token under the authenticated user's ID
    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        { user_id: user.id, token, updated_at: new Date().toISOString() },
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
