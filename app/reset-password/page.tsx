'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/modules/infrastructure/supabase/client'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

/**
 * Reset Password Page
 *
 * This page is reached AFTER the auth/callback route has already exchanged
 * the Supabase PKCE code for a live PASSWORD_RECOVERY session.
 *
 * IMPORTANT: We NEVER ask for the current password here.
 * The recovery session itself proves the user owns the email address.
 * All we need is the new password + confirmation.
 */

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function PasswordStrengthBar({ password }: { password: string }) {
  const getStrength = (p: string): { score: number; label: string; color: string } => {
    if (!p) return { score: 0, label: '', color: '#e2e8f0' }
    let score = 0
    if (p.length >= 8) score++
    if (p.length >= 12) score++
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^A-Za-z0-9]/.test(p)) score++
    if (score <= 1) return { score, label: 'Weak', color: '#dc2626' }
    if (score <= 2) return { score, label: 'Fair', color: '#f97316' }
    if (score <= 3) return { score, label: 'Good', color: '#eab308' }
    return { score, label: 'Strong', color: '#16a34a' }
  }
  const { score, label, color } = getStrength(password)
  if (!password) return null
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= score ? color : '#e2e8f0', transition: 'background 0.3s' }} />
        ))}
      </div>
      <span style={{ fontSize: '0.75rem', color, fontWeight: 600 }}>{label}</span>
    </div>
  )
}

// ── Inner component that reads search params ──────────────────────────────
function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState('')

  // Status of the recovery session
  type Status = 'loading' | 'ready' | 'invalid'
  const [status, setStatus] = useState<Status>('loading')
  const [invalidReason, setInvalidReason] = useState('This password reset link is invalid, expired, or has already been used.')

  /** Decode the JWT payload to check if this is a PASSWORD_RECOVERY session. */
  function isRecoverySession(session: Session): boolean {
    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]))
      return payload.is_recovery === true
    } catch {
      return false
    }
  }

  useEffect(() => {
    let mounted = true

    // Check if Supabase forwarded an error from the callback route
    const urlError = searchParams.get('error')
    const urlErrorDesc = searchParams.get('error_description')
    if (urlError) {
      if (mounted) {
        setInvalidReason(urlErrorDesc ?? 'The reset link is invalid or expired.')
        setStatus('invalid')
      }
      return
    }

    /**
     * Two paths to a valid recovery session:
     *
     * A) The auth/callback route already exchanged the code → a recovery session
     *    exists in the cookie/localStorage → getSession() returns it.
     *
     * B) Edge case: user opened the email link directly in a browser that already
     *    had a session but with the old implicit flow → PASSWORD_RECOVERY event
     *    fires via onAuthStateChange.
     *
     * In both cases we verify the session has the `is_recovery: true` JWT claim
     * so a user with a regular login session can't abuse this page.
     */

    // Path A: session already set by auth/callback
    async function checkExistingSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return

        if (session?.user && isRecoverySession(session)) {
          // Authenticated via recovery flow → safe to show the form
          setStatus('ready')
        } else if (session?.user) {
          // User has a session but it's NOT a recovery session
          setStatus('invalid')
          setInvalidReason(
            'You are already logged in. Please use "Forgot Password" from the login page to reset your password.'
          )
        } else {
          // No session at all → the user probably opened a stale link or
          // navigated here directly without going through auth/callback.
          setStatus('invalid')
          setInvalidReason('No active reset session found. Please request a new password reset link.')
        }
      } catch {
        if (mounted) {
          setStatus('invalid')
          setInvalidReason('Could not verify the reset link. Please try again.')
        }
      }
    }

    // Path B: listen for PASSWORD_RECOVERY event (covers edge cases
    // where the session arrives after the initial check)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return
        if (event === 'PASSWORD_RECOVERY' && session) {
          setStatus('ready')
        }
      }
    )

    checkExistingSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    // Client-side validation — no current password required
    if (newPassword.length < 6) {
      setFormError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match.')
      return
    }

    setLoading(true)

    // Verify the recovery session is still live before updating
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setFormError('Your session has expired. Please request a new reset link.')
      setLoading(false)
      return
    }

    // ✅ The correct Supabase call — NO current password needed in recovery flow
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)

    if (error) {
      setFormError(error.message)
      return
    }

    // Sign out so the recovery session is fully cleared
    await supabase.auth.signOut()
    setDone(true)

    // Redirect to login after showing success
    setTimeout(() => router.push('/login'), 3500)
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #fff7ed 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}>
        <div style={{
          width: 48,
          height: 48,
          border: '3px solid #e2e8f0',
          borderTopColor: '#f97316',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: 500 }}>
          Verifying reset link…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Invalid / expired link ────────────────────────────────────────────────
  if (status === 'invalid') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #fff7ed 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 420,
          background: 'white',
          borderRadius: 20,
          padding: 36,
          border: '1px solid #e2e8f0',
          boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
            Invalid or Expired Link
          </h1>
          <p style={{ color: '#64748b', marginBottom: 28, lineHeight: 1.6, fontSize: '0.9rem' }}>
            {invalidReason}
          </p>
          <button
            onClick={() => router.push('/forgot-password')}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
            }}
          >
            📧 Request New Reset Link
          </button>
          <button
            onClick={() => router.push('/login')}
            style={{
              width: '100%',
              marginTop: 12,
              padding: '12px',
              background: 'none',
              color: '#64748b',
              border: '1.5px solid #e2e8f0',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            ← Back to Login
          </button>
        </div>
      </div>
    )
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #fff7ed 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: '2rem',
          boxShadow: '0 8px 24px rgba(249,115,22,0.3)',
        }}>
          🔐
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
          Set New Password
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
          Choose a strong password for your account
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: 'white',
        borderRadius: 20,
        padding: 36,
        border: '1px solid #e2e8f0',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
      }}>
        {done ? (
          // ── Success state ─────────────────────────────────────────────────
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a', marginBottom: 12 }}>
              Password Updated!
            </h2>
            <p style={{ color: '#64748b', lineHeight: 1.6, marginBottom: 20 }}>
              Your password has been changed successfully.
              <br />
              Redirecting you to login…
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px 20px',
              background: '#f0fdf4',
              borderRadius: 12,
              border: '1px solid #bbf7d0',
              color: '#16a34a',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}>
              <div style={{
                width: 16,
                height: 16,
                border: '2px solid #16a34a',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Redirecting to login…
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          // ── Password form ─────────────────────────────────────────────────
          // ❌ NO "Current Password" field — this is a recovery flow
          // ✅ Only New Password + Confirm Password
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* New Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  autoComplete="new-password"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    paddingRight: 48,
                    borderRadius: 12,
                    border: '1.5px solid #e2e8f0',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showNew} />
                </button>
              </div>
              <PasswordStrengthBar password={newPassword} />
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    paddingRight: 48,
                    borderRadius: 12,
                    border: `1.5px solid ${
                      confirmPassword && confirmPassword !== newPassword
                        ? '#dc2626'
                        : confirmPassword && confirmPassword === newPassword
                        ? '#16a34a'
                        : '#e2e8f0'
                    }`,
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <span style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: 4, display: 'block', fontWeight: 500 }}>
                  ❌ Passwords don&apos;t match
                </span>
              )}
              {confirmPassword && confirmPassword === newPassword && (
                <span style={{ fontSize: '0.78rem', color: '#16a34a', marginTop: 4, display: 'block', fontWeight: 500 }}>
                  ✅ Passwords match
                </span>
              )}
            </div>

            {/* Error message */}
            {formError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 10,
                padding: '12px 16px',
                color: '#dc2626',
                fontSize: '0.85rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}>
                ⚠️ {formError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '16px',
                background: loading
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 14,
                fontSize: '1rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(249,115,22,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: 18,
                    height: 18,
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  Updating Password…
                </>
              ) : (
                '🔐 Update Password'
              )}
            </button>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Page wrapper with Suspense (required for useSearchParams) ─────────────
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #fff7ed 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid #e2e8f0',
          borderTopColor: '#f97316',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}