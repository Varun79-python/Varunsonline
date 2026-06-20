/**
 * lib/rateLimit.ts
 *
 * Production-safe rate limiter backed by Supabase DB.
 * Replaces the in-memory Map() implementation that does not
 * work across Vercel Lambda instances.
 *
 * Uses the `increment_rate_limit` Postgres function which performs
 * an atomic INSERT ... ON CONFLICT DO UPDATE — safe for concurrent
 * serverless invocations.
 *
 * Fallback: if the DB call fails (e.g. cold-start error), the
 * request is ALLOWED to avoid false-positive blocks on legitimate
 * traffic. This is intentional — the DB limiter is a best-effort
 * safety net, not a hard gate.
 *
 * Call sites (unchanged API):
 *   checkRateLimit(identifier, config) → { allowed, remaining, resetTime }
 *   getRateLimitIdentifier(request)    → string (IP)
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  windowMs?: number
  maxRequests?: number
  message?: string
  /** Logical endpoint name used as part of the DB key (e.g. 'place-order') */
  endpoint?: string
}

// ── Supabase service client (reused across calls in same Lambda warm instance) ─

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Core rate limit check ─────────────────────────────────────────────────────

const DEFAULT_WINDOW_MS   = 60 * 1000 // 1 minute
const DEFAULT_MAX_REQUESTS = 10

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {}
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const windowMs    = config.windowMs    ?? DEFAULT_WINDOW_MS
  const maxRequests = config.maxRequests ?? DEFAULT_MAX_REQUESTS
  const endpoint    = config.endpoint    ?? 'default'
  const resetTime   = Date.now() + windowMs

  try {
    const supabase = getServiceClient()

    const { data, error } = await supabase.rpc('increment_rate_limit', {
      p_identifier: identifier,
      p_endpoint:   endpoint,
      p_window_ms:  windowMs,
    })

    if (error) {
      // DB error — fail open (allow) to avoid blocking legitimate users
      console.error('[rateLimit] DB error, failing open:', error.message)
      return { allowed: true, remaining: maxRequests - 1, resetTime }
    }

    const count = data as number
    const allowed = count <= maxRequests
    const remaining = Math.max(0, maxRequests - count)

    return { allowed, remaining, resetTime }
  } catch (err) {
    // Network/cold-start error — fail open
    console.error('[rateLimit] Unexpected error, failing open:', err)
    return { allowed: true, remaining: maxRequests - 1, resetTime }
  }
}

// ── Identifier helper (unchanged) ────────────────────────────────────────────

export function getRateLimitIdentifier(request: Request | NextRequest): string {
  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
  return ip
}

// ── Middleware factory (unchanged interface, now async-aware) ─────────────────

export function createRateLimitMiddleware(config: RateLimitConfig = {}) {
  return async (request: NextRequest) => {
    const identifier = getRateLimitIdentifier(request)
    const result = await checkRateLimit(identifier, config)

    if (!result.allowed) {
      return new NextResponse(
        JSON.stringify({ error: config.message || 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
            'Content-Type': 'application/json',
          },
        }
      )
    }

    return null // Continue to handler
  }
}