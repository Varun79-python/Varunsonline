'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading')

  useEffect(() => {
    let mounted = true

    async function initRecoverySession() {
      try {
        // First, check if Supabase has already processed the hash (it auto-reads tokens from URL hash)
        const { data: { session: existingSession } } = await supabase.auth.getSession()
        
        if (existingSession && existingSession.user) {
          // Session already exists from hash processing
          if (mounted) {
            setStatus('valid')
          }
          return
        }

        // If no existing session, manually check hash for tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')

        // Also check if type=recovery in query params (some setups use query params)
        const urlParams = new URLSearchParams(window.location.search)
        const queryType = urlParams.get('type')
        const queryToken = urlParams.get('token')

        // If we have access token in hash, try to set session
        if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })

          if (sessionError) {
            console.error('Session error:', sessionError)
            if (mounted) setStatus('invalid')
            return
          }

          if (data.session) {
            if (mounted) setStatus('valid')
            return
          }
        }

        // Try query params if present
        if (queryToken && queryType === 'recovery') {
          // Some Supabase configs use query params - need to exchange for access token
          // This is less common but handle it anyway
          console.log('Query token detected, may need exchange')
        }

        // Check if we have any valid session at all
        const { data: { session } } = await supabase.auth.getSession()
        if (session && session.user) {
          if (mounted) setStatus('valid')
          return
        }

        // No valid session found
        if (mounted) setStatus('invalid')
      } catch (err) {
        console.error('Recovery init error:', err)
        if (mounted) setStatus('invalid')
      }
    }

    // Also listen for auth state changes - Supabase sends PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        if (mounted) setStatus('valid')
      }
    })

    initRecoverySession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setLoading(true)
    
    // Verify we have a valid session before updating
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Session expired. Please request a new password reset link.')
      setLoading(false)
      return
    }

    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) { 
      setError(err.message)
      return 
    }
    
    // Sign out after password change for security
    await supabase.auth.signOut()
    setDone(true)
    
    // Redirect after showing success message
    setTimeout(() => router.push('/login'), 3000)
  }

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Verifying reset link...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
          <h2 style={{ marginBottom: 12, fontWeight: 700, color: '#0f172a' }}>Invalid or Expired Link</h2>
          <p style={{ color: '#64748b', marginBottom: 24, maxWidth: 300 }}>
            This password reset link is invalid, expired, or has already been used. Please request a new one.
          </p>
          <button onClick={() => router.push('/forgot-password')} style={{ padding: '12px 24px', background: '#f97316', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
            Request New Link
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔐</div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Set New Password</h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Choose a strong password for your account</p>
      </div>

      <div style={{ width: '100%', maxWidth: 420, background: 'white', borderRadius: 16, padding: 32, border: '1px solid #e2e8f0', boxShadow: '0 8px 40px rgba(0,0,0,0.1)' }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
            <h2 style={{ marginBottom: 12, color: '#16a34a', fontWeight: 700 }}>Password Updated!</h2>
            <p style={{ color: '#64748b', marginBottom: 24 }}>
              Your password has been changed successfully. Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '14px 16px', paddingRight: 44, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {showPassword ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  style={{ width: '100%', padding: '14px 16px', paddingRight: 44, borderRadius: 10, border: confirm && confirm !== password ? '1.5px solid #dc2626' : '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {showConfirm ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
              {confirm && confirm !== password && (
                <span style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: 4, display: 'block' }}>❌ Passwords don't match</span>
              )}
              {confirm && confirm === password && (
                <span style={{ fontSize: '0.78rem', color: '#16a34a', marginTop: 4, display: 'block' }}>✅ Passwords match</span>
              )}
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: '0.85rem' }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ padding: '16px', background: loading ? '#94a3b8' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Updating...' : '🔐 Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}