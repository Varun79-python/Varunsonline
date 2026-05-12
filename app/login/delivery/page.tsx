'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeliveryLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')

  async function handleResetPassword() {
    if (!resetEmail.trim()) { setResetMessage('Please enter your email'); return }
    setResetLoading(true)
    setResetMessage('')
    const redirectUrl = process.env.NODE_ENV === 'production' ? 'https://www.varunsonline.com/reset-password' : `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), { redirectTo: redirectUrl })
    if (error) { setResetMessage(error.message); setResetLoading(false); return }
    setResetMessage('Password reset link sent to your email!')
    setResetLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/delivery')
    } else {
      router.push('/delivery/register')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <img src="/logo.png" alt="VarunsOnline" style={{ width: 40, height: 40, objectFit: 'contain' }} />
      </div>

      <div style={{ flex: 1, padding: '0 24px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '2rem' }}>🛵</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{isLogin ? 'Delivery Partner' : 'Join as Delivery Partner'}</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{isLogin ? 'Sign in to start delivering' : 'Register to start earning'}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required style={{ padding: '14px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white' }} />
          <input type="password" placeholder="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required style={{ padding: '14px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white' }} />

          {error && <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: 10, color: '#dc2626', fontSize: '0.85rem', fontWeight: 500 }}>{error}</div>}

          {isLogin && (
            <button type="button" onClick={() => { setResetEmail(form.email); setShowReset(true) }} style={{ background: 'none', border: 'none', color: '#22c55e', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center', marginBottom: -4 }}>Forgot Password?</button>
          )}

          <button type="submit" disabled={loading} style={{ padding: '16px', background: loading ? '#94a3b8' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: 'white', border: 'none', borderRadius: 14, fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 16px rgba(34,197,94,0.3)' }}>
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{isLogin ? "New here?" : 'Already registered?'} </span>
          <button onClick={() => { setIsLogin(!isLogin); setError('') }} style={{ background: 'none', border: 'none', color: '#22c55e', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>{isLogin ? 'Register' : 'Login'}</button>
        </div>
      </div>

      {showReset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowReset(false)}>
          <div style={{ background: 'white', borderRadius: 20, padding: 24, maxWidth: 400, width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Forgot Password?</h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 16 }}>Enter your email to receive a password reset link.</p>
            <input type="email" placeholder="Your email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', marginBottom: 12, boxSizing: 'border-box' }} />
            {resetMessage && <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, marginBottom: 12, background: resetMessage.includes('sent') ? '#dcfce7' : '#fee2e2', color: resetMessage.includes('sent') ? '#16a34a' : '#dc2626' }}>{resetMessage}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowReset(false)} style={{ flex: 1, padding: '14px', background: '#f1f5f9', border: 'none', borderRadius: 12, color: '#475569', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleResetPassword} disabled={resetLoading} style={{ flex: 1, padding: '14px', background: resetLoading ? '#94a3b8' : '#22c55e', border: 'none', borderRadius: 12, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: resetLoading ? 'not-allowed' : 'pointer' }}>{resetLoading ? 'Sending...' : 'Send Link'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}