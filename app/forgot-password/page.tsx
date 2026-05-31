'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError('')
    // Must route through /auth/callback so the PKCE code is exchanged for
    // a real session BEFORE the user lands on /reset-password.
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://www.varunsonline.com'
      : window.location.origin
    const redirectUrl = `${baseUrl}/auth/callback?next=/reset-password`
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl
    })
    setLoading(false)
    if (err) {
      // Log the error but always show success to prevent enumeration
      console.error('Password reset error:', err.message)
    }
    setSent(true)
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px'
    }}>
      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔑</div>
        <h1 className="gradient-text" style={{ fontSize: '1.8rem', marginBottom: 6 }}>Reset Password</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          We&apos;ll send a reset link to your email
        </p>
      </div>

      <div style={{
        width: '100%', maxWidth: 420, background: 'var(--card)',
        borderRadius: 'var(--radius)', padding: 32,
        border: '1px solid var(--border)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)'
      }}>
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>📧</div>
            <h2 style={{ marginBottom: 12, color: 'var(--success)' }}>Email Sent!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
              We sent a password reset link to
            </p>
            <p style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 24 }}>{email}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 24 }}>
              Click the link in your email to set a new password. Check your spam folder if you don&apos;t see it.
            </p>
            <a href="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center' }}>
              ← Back to Login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="input-group">
              <label className="input-label">Your Registered Email</label>
              <input
                className="input"
                type="email"
                placeholder="yourname@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: '0.85rem'
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-full btn-lg"
            >
              {loading
                ? <span className="spin" style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
                : '📧 Send Reset Link'
              }
            </button>

            <a href="/login" style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              ← Back to Login
            </a>
          </form>
        )}
      </div>
    </div>
  )
}
