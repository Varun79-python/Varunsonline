'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }

    const user = data.user
    if (!user) { setError('Login failed'); setLoading(false); return }

    // Wait for session to be fully established
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Session error'); setLoading(false); return }

    // Check 1: user_metadata.role (set during account creation — no DB needed)
    const metaRole = user.user_metadata?.role
    if (metaRole === 'admin') {
      window.location.href = '/admin'
      return
    }

    // Check 2: app_metadata.role (set via Supabase admin API)
    const appRole = user.app_metadata?.role
    if (appRole === 'admin') {
      window.location.href = '/admin'
      return
    }

    // Check 3: profiles table (if schema has been run)
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profileErr && profile?.role === 'admin') {
      window.location.href = '/admin'
      return
    }

    // Check 4: hardcoded admin email as final fallback (owner's email)
    const ADMIN_EMAIL = 'venkatavarun79@gmail.com'
    if (user.email === ADMIN_EMAIL) {
      // Also try to upsert the profile so future logins use Check 3
      await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || 'Varun Admin',
        role: 'admin',
        is_active: true,
      }).then(() => {})
      window.location.href = '/admin'
      return
    }

    // None of the checks passed
    setError('Access denied. This account is not an admin.')
    await supabase.auth.signOut()
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>👑</div>
          <h2 style={{ marginBottom: 4 }}>Admin Login</h2>
          <p style={{ color: 'var(--text-muted)' }}>Varun&apos;s Online Control Panel</p>
        </div>
        <form className="card" onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#fca5a5', fontSize: '0.88rem' }}>
              ⚠️ {error}
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Admin Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {showPassword ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>
          </div>
          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
            {loading ? '⏳ Verifying...' : '👑 Admin Login'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.82rem', color: 'var(--text-dim)' }}>
          <a href="/login" style={{ color: 'var(--text-muted)' }}>← Back to main login</a>
        </p>
      </div>
    </div>
  )
}
