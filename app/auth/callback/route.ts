import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Supabase Auth Callback Route
 *
 * This route handles the PKCE (Proof Key for Code Exchange) code exchange
 * that Supabase uses by default in modern versions.
 *
 * Flow:
 *  1. User clicks reset-password / confirm-email link in their inbox
 *  2. Supabase redirects to: /auth/callback?code=XXXX&next=/reset-password
 *  3. This route exchanges the one-time code for a real session (access + refresh token)
 *  4. Redirects the user to the `next` page (e.g. /reset-password)
 *  5. The reset-password page now has a live PASSWORD_RECOVERY session
 *     and can call supabase.auth.updateUser({ password }) without needing
 *     the current password.
 *
 * Without this route the PKCE code is never exchanged, no session is
 * established, and Supabase rejects the password update (or wrongly
 * uses a pre-existing session that is NOT a recovery session).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Where to redirect after a successful code exchange
  const next = searchParams.get('next') ?? '/reset-password'

  // ── Error sent by Supabase (e.g. expired link) ──────────────────────────
  if (error) {
    const params = new URLSearchParams({
      error: error,
      error_description: errorDescription ?? 'An unknown error occurred.',
    })
    return NextResponse.redirect(`${origin}/reset-password?${params.toString()}`)
  }

  // ── No code present — redirect to forgot-password ────────────────────────
  if (!code) {
    return NextResponse.redirect(`${origin}/forgot-password`)
  }

  // ── Exchange the PKCE code for a session ─────────────────────────────────
  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('[auth/callback] Code exchange failed:', exchangeError.message)
    const params = new URLSearchParams({
      error: 'exchange_failed',
      error_description: exchangeError.message,
    })
    return NextResponse.redirect(`${origin}/reset-password?${params.toString()}`)
  }

  // ── Success — forward to the intended page (e.g. /reset-password) ────────
  // Use a 302 redirect so the browser GETs the destination page fresh.
  return NextResponse.redirect(`${origin}${next}`)
}
