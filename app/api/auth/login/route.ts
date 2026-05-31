/**
 * POST /api/auth/login
 *
 * Production-grade authentication endpoint with built-in login tracking
 * and account lockout. All login flows (customer, shopkeeper, delivery,
 * admin) MUST go through this endpoint — NO direct supabase.auth
 * signInWithPassword() calls from client components.
 *
 * Flow:
 *   Client → POST /api/auth/login
 *   → Lockout Check (profiles.locked_until)
 *   → Supabase Authentication (signInWithPassword)
 *   → Record attempt (login_attempts table)
 *   → Success: reset counters, update last_login
 *   → Failure: increment counters, apply lockout if threshold reached
 *
 * Security:
 *   - All failures return "Invalid login credentials" (prevents enumeration)
 *   - Lockout check happens BEFORE Supabase call (no timing oracle)
 *   - Detailed reasons logged, never returned to client
 *   - Role-specific thresholds (admin stricter)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import {
  checkAccountLockout,
  handleFailedLogin,
  handleSuccessfulLogin,
} from '@/lib/loginTracker'

// ── Request / Response types ──────────────────────────────────────────────────

interface LoginRequest {
  email?: string
  phone?: string
  password: string
  /** Determines lockout thresholds. One of: customer, shopkeeper, delivery, admin */
  role?: string
}

interface LoginResponse {
  success?: boolean
  error?: string
  user?: {
    id: string
    email?: string | null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    const body: LoginRequest = await request.json()
    const { email: rawEmail, phone, password, role = 'customer' } = body

    // Basic validation
    if (!password) {
      return respond('Invalid login credentials', 401)
    }

    // ── Resolve email (phone → email if needed) ──────────────────────────────
    const email = await resolveEmail(rawEmail, phone)
    if (!email) {
      return respond('Invalid login credentials', 401)
    }

    // ── Extract request metadata ─────────────────────────────────────────────
    const ipAddress = getClientIp(request)
    const userAgent = request.headers.get('user-agent') || undefined

    // ── Lockout Check (BEFORE Supabase auth) ─────────────────────────────────
    const lockout = await checkAccountLockout(email, role)
    if (lockout.locked) {
      logger.auth('login_blocked_locked', {
        email,
        role,
        ip: ipAddress,
        reason: lockout.reason,
      })
      // Return generic error — never reveal lockout status
      return respond('Invalid login credentials', 401)
    }

    // ── Supabase Authentication ──────────────────────────────────────────────
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data?.user) {
      // ── Failed Login ───────────────────────────────────────────────────────
      await handleFailedLogin({
        email,
        ipAddress,
        userAgent,
        role,
        failureReason: error?.message || 'authentication_failed',
      })

      return respond('Invalid login credentials', 401)
    }

    // ── Successful Login ─────────────────────────────────────────────────────
    await handleSuccessfulLogin({
      email,
      userId: data.user.id,
      ipAddress,
      role,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
  } catch (err) {
    // Catch-all: never expose internal errors
    logger.error('login_api_crash', { error: String(err) })
    return respond('Invalid login credentials', 500)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function respond(error: string, status: number): NextResponse<LoginResponse> {
  return NextResponse.json({ error }, { status })
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}

async function resolveEmail(
  email?: string,
  phone?: string
): Promise<string | null> {
  if (email) {
    return email.trim().toLowerCase()
  }

  if (phone) {
    const digitsOnly = phone.replace(/\D/g, '')
    if (!/^\d{10,}$/.test(digitsOnly)) return null

    // Look up email by phone using service role (bypasses RLS)
    try {
      const lookupClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const { data: profile } = await lookupClient
        .from('profiles')
        .select('email')
        .eq('phone', digitsOnly)
        .maybeSingle()

      return profile?.email || null
    } catch {
      return null
    }
  }

  return null
}
