'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminLoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(true)
  const [adminEmail, setAdminEmail] = useState('')

  // Fetch admin email from server-side endpoint (not exposed in client bundle)
  useEffect(() => {
    fetch('/api/admin/email').then(r => r.json()).then(d => {
      if (d.email) setAdminEmail(d.email)
    }).catch(() => {})
  }, [])

  // Helper: full-page redirect so middleware sees the cookie
  function goToAdmin() {
    window.location.href = '/admin'
  }

  // Check if already authenticated on page load
  useEffect(() => {
    async function checkExistingSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          const user = session.user
          const metaRole = user.user_metadata?.role || user.app_metadata?.role

          if (metaRole === 'admin' || (adminEmail && user.email === adminEmail)) {
            goToAdmin()
            return
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()

          if (profile?.role === 'admin') {
            goToAdmin()
            return
          }

          // Logged in but not admin — sign out and show form
          await supabase.auth.signOut()
        }
      } catch (err) {
        console.error('Session check error:', err)
      } finally {
        setInitializing(false)
        setLoading(false)
      }
    }

    checkExistingSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setError(err.message); setLoading(false); return }

      const user = data.user
      if (!user) { setError('Login failed'); setLoading(false); return }

      // Check 1: user_metadata.role
      if (user.user_metadata?.role === 'admin') {
        goToAdmin(); return
      }

      // Check 2: app_metadata.role
      if (user.app_metadata?.role === 'admin') {
        goToAdmin(); return
      }

      // Check 3: profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.role === 'admin') {
        goToAdmin(); return
      }

      // Check 4: hardcoded admin email — upsert profile and allow in
      if (adminEmail && user.email === adminEmail) {
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || 'Varun Admin',
          role: 'admin',
          is_active: true,
        }, { onConflict: 'id' })
        goToAdmin(); return
      }

      // Access denied
      setError('Access denied. This account is not an admin.')
      await supabase.auth.signOut()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (initializing) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton width={180} height={28} borderRadius={8} style={{ margin: '0 auto' }} />
          <Skeleton width={120} height={14} borderRadius={6} style={{ margin: '0 auto' }} />
          <div style={{ height: 12 }} />
          <Skeleton width="100%" height={48} borderRadius={8} />
          <Skeleton width="100%" height={48} borderRadius={8} />
          <Skeleton width={100} height={40} borderRadius={8} style={{ margin: '0 auto' }} />
        </div>
      </div>
    )
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
                {showPassword
                  ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
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
