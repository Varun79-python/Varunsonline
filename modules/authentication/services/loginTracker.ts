/**
 * lib/loginTracker.ts
 *
 * Production-grade login tracking and account lockout.
 *
 * Tracks every login attempt (success/failure) in the login_attempts table
 * and enforces escalating lockout thresholds on the profiles table.
 *
 * Architecture:
 *   Client → POST /api/auth/login → Lockout Check → Supabase Auth → Record → Response
 *
 * Lockout thresholds per role:
 *   Standard (customer, shopkeeper, delivery):
 *     5 failures  → 15 minute lockout
 *     10 failures → 1 hour lockout
 *     15 failures → 24 hour lockout
 *
 *   Admin:
 *     3 failures → 15 minute lockout
 *     5 failures → 1 hour lockout
 *
 * Security principles:
 *   - Never reveal account existence (always return "Invalid login credentials")
 *   - Lockout check happens BEFORE Supabase auth attempt (no timing oracle)
 *   - Detailed failure reasons only in logs, never in responses
 *   - IP-based tracking for forensic analysis
 */

import { createClient } from '@supabase/supabase-js'
import { logger } from '@/modules/infrastructure/services/logger'

// ── Constants ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export type LoginRole = 'customer' | 'shopkeeper' | 'delivery' | 'admin'

interface Threshold {
  failures: number
  durationMs: number
  label: string
}

const STANDARD_THRESHOLDS: Threshold[] = [
  { failures: 5,  durationMs: 15 * 60 * 1000,  label: '5 failures → 15 min' },
  { failures: 10, durationMs: 60 * 60 * 1000,   label: '10 failures → 1 hr' },
  { failures: 15, durationMs: 24 * 60 * 60 * 1000, label: '15 failures → 24 hr' },
]

const ADMIN_THRESHOLDS: Threshold[] = [
  { failures: 3, durationMs: 15 * 60 * 1000, label: '3 failures → 15 min' },
  { failures: 5, durationMs: 60 * 60 * 1000, label: '5 failures → 1 hr' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getThresholds(role: string): Threshold[] {
  return role === 'admin' ? ADMIN_THRESHOLDS : STANDARD_THRESHOLDS
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LockoutStatus {
  locked: boolean
  /** Human-readable reason for logs only */
  reason?: string
}

export interface RecordAttemptParams {
  email?: string
  phone?: string
  userId?: string
  ipAddress?: string
  userAgent?: string
  success: boolean
  role?: string
  failureReason?: string
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether the account associated with `email` is currently locked.
 * If lockout has expired, clears it automatically.
 *
 * Returns `{ locked: false }` if no profile exists for the email (prevents
 * timing attacks on account existence).
 */
export async function checkAccountLockout(
  email: string,
  role: string = 'customer'
): Promise<LockoutStatus> {
  if (!email) return { locked: false }

  const supabase = getServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('failed_login_count, locked_until')
    .eq('email', email)
    .maybeSingle()

  if (!profile) return { locked: false }

  // Check if currently locked
  if (profile.locked_until) {
    const lockedUntil = new Date(profile.locked_until)
    if (lockedUntil > new Date()) {
      logger.auth('lockout_active', {
        email,
        role,
        until: profile.locked_until,
        failedCount: profile.failed_login_count,
      })
      return { locked: true, reason: 'account_locked' }
    }

    // Lockout expired — clear it silently
    await supabase
      .from('profiles')
      .update({ locked_until: null, updated_at: new Date().toISOString() })
      .eq('email', email)
  }

  return { locked: false }
}

/**
 * Record a login attempt in the login_attempts audit table.
 * Failures are logged via logger.auth() for operational visibility.
 */
export async function recordLoginAttempt(params: RecordAttemptParams): Promise<void> {
  const supabase = getServiceClient()

  try {
    await supabase.from('login_attempts').insert({
      email:          params.email          || null,
      phone:          params.phone          || null,
      user_id:        params.userId         || null,
      ip_address:     params.ipAddress      || null,
      user_agent:     params.userAgent      || null,
      success:        params.success,
      role:           params.role           || null,
      failure_reason: params.failureReason  || null,
    })
  } catch (err) {
    // Never let a DB failure break the login flow
    console.error('[loginTracker] Failed to record login attempt:', err)
  }
}

/**
 * Process a failed login:
 * 1. Log the failure via logger.auth()
 * 2. Record the attempt in login_attempts
 * 3. Increment failed_login_count on the profile
 * 4. Apply lockout if threshold is reached
 *
 * Only operates on existing profiles. Non-existent emails are silently ignored
 * (they already got the generic error response).
 */
export async function handleFailedLogin(params: {
  email: string
  ipAddress?: string
  userAgent?: string
  role?: string
  failureReason?: string
}): Promise<void> {
  const { email, ipAddress, userAgent, role = 'customer', failureReason } = params
  const supabase = getServiceClient()

  // Log the failure
  logger.auth('login_failed', {
    email,
    role,
    ip: ipAddress,
    reason: failureReason,
  })

  // Record attempt
  await recordLoginAttempt({
    email,
    ipAddress,
    userAgent,
    success: false,
    role,
    failureReason,
  })

  // Find profile by email — only track lockout for known accounts
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, failed_login_count, locked_until')
    .eq('email', email)
    .maybeSingle()

  if (!profile) return

  const newCount = (profile.failed_login_count || 0) + 1
  const thresholds = getThresholds(role)

  // Calculate the longest applicable lockout duration
  let lockoutDurationMs = 0
  for (const t of thresholds) {
    if (newCount >= t.failures) {
      lockoutDurationMs = t.durationMs
    }
  }

  const updateData: Record<string, unknown> = {
    failed_login_count: newCount,
    updated_at: new Date().toISOString(),
  }

  if (lockoutDurationMs > 0) {
    const lockedUntil = new Date(Date.now() + lockoutDurationMs).toISOString()
    updateData.locked_until = lockedUntil
    logger.auth('account_locked', {
      email,
      role,
      until: lockedUntil,
      failedCount: newCount,
      thresholds: thresholds.map(t => t.label).join('; '),
    })
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', profile.id)

  if (updateError) {
    console.error('[loginTracker] Failed to update lockout counters:', updateError.message)
  }
}

/**
 * Process a successful login:
 * 1. Log the success
 * 2. Record the attempt in login_attempts
 * 3. Reset failed_login_count and locked_until
 * 4. Update last_login_at and last_login_ip
 */
export async function handleSuccessfulLogin(params: {
  email: string
  userId: string
  ipAddress?: string
  role?: string
}): Promise<void> {
  const { email, userId, ipAddress, role } = params
  const supabase = getServiceClient()

  logger.info('login_success', { email, role, ip: ipAddress })

  // Record successful attempt
  await recordLoginAttempt({
    email,
    userId,
    ipAddress,
    success: true,
    role,
  })

  // Reset counters and update timestamps
  const { error } = await supabase
    .from('profiles')
    .update({
      failed_login_count: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
      last_login_ip: ipAddress || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) {
    console.error('[loginTracker] Failed to update profile on successful login:', error.message)
  }
}

/**
 * Get human-readable lockout threshold description for a role.
 * Useful for documentation / debugging.
 */
export function getLockoutPolicy(role: string): string {
  const thresholds = getThresholds(role)
  return thresholds.map(t => t.label).join(', ')
}
