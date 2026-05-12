'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
    async function checkRecoverySession() {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })
        if (!error) {
          setValidSession(true)
          setChecking(false)
          return
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setValidSession(true)
      }
      setChecking(false)
    }

    checkRecoverySession()
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
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
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
        ) : !validSession ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
            <h2 style={{ marginBottom: 12, fontWeight: 700, color: '#0f172a' }}>Invalid or Expired Link</h2>
            <p style={{ color: '#64748b', marginBottom: 24 }}>
              This reset link has expired or already been used. Please request a new one.
            </p>
            <button onClick={() => router.push('/login')} style={{ padding: '12px 24px', background: '#f97316', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
              Go to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box', paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Confirm New Password</label>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: confirm && confirm !== password ? '1.5px solid #dc2626' : '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
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

function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ResetPasswordForm />
    </Suspense>
  )
}