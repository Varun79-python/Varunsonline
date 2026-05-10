'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [validSession, setValidSession] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    // Supabase handles the token in the URL hash automatically
    // We just need to check if we have a valid recovery session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true)
        setChecking(false)
      } else if (session && event === 'SIGNED_IN') {
        setValidSession(true)
        setChecking(false)
      }
    })

    // Also check immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setValidSession(true) }
      setChecking(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => router.push('/login'), 3000)
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔐</div>
        <h1 className="gradient-text" style={{ fontSize: '1.8rem', marginBottom: 6 }}>Set New Password</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Choose a strong password for your account</p>
      </div>

      <div style={{
        width: '100%', maxWidth: 420, background: 'var(--card)',
        borderRadius: 'var(--radius)', padding: 32,
        border: '1px solid var(--border)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)'
      }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
            <h2 style={{ marginBottom: 12, color: 'var(--success)' }}>Password Updated!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
              Your password has been changed successfully. Redirecting to login...
            </p>
            <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--success)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : !validSession ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
            <h2 style={{ marginBottom: 12 }}>Invalid or Expired Link</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
              This reset link has expired or already been used. Please request a new one.
            </p>
            <a href="/forgot-password" className="btn btn-primary" style={{ display: 'block', textAlign: 'center' }}>
              Request New Link
            </a>
          </div>
        ) : (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="input-group">
              <label className="input-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPass(s => !s)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', padding: 4,
                }}>
                  {showPass
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
              {/* Strength indicator */}
              {password && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{
                      flex: 1, height: 4, borderRadius: 2,
                      background: password.length >= i * 3
                        ? (password.length >= 12 ? '#22c55e' : password.length >= 8 ? '#f97316' : '#ef4444')
                        : 'var(--border)'
                    }} />
                  ))}
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Confirm New Password</label>
              <input
                className="input"
                type={showPass ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                style={{ borderColor: confirm && confirm !== password ? 'rgba(239,68,68,0.5)' : undefined }}
              />
              {confirm && confirm !== password && (
                <span style={{ fontSize: '0.78rem', color: '#fca5a5', marginTop: 4 }}>❌ Passwords don&apos;t match</span>
              )}
              {confirm && confirm === password && (
                <span style={{ fontSize: '0.78rem', color: 'var(--success)', marginTop: 4 }}>✅ Passwords match</span>
              )}
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: '0.85rem'
              }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary btn-full btn-lg">
              {loading
                ? <span className="spin" style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
                : '🔐 Update Password'
              }
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
