'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function generateCaptcha(length = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function CaptchaDisplay({ code }: { code: string }) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      justifyContent: 'center',
      padding: '12px 16px',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      borderRadius: 10,
      marginBottom: 12
    }}>
      {code.split('').map((char, i) => (
        <span key={i} style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: ['#f97316', '#22c55e', '#3b82f6', '#f43f5e', '#a855f7'][i % 5],
          fontFamily: 'monospace',
          transform: `rotate(${[-5, 5, -3, 8, -2][i % 5]}deg)`,
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>{char}</span>
      ))}
    </div>
  )
}

export default function ShopkeeperLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [captcha, setCaptcha] = useState(() => generateCaptcha())
  const [captchaInput, setCaptchaInput] = useState('')

  async function refreshCaptcha() {
    setCaptcha(generateCaptcha())
    setCaptchaInput('')
  }

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

    if (captchaInput.toUpperCase() !== captcha) {
      setError('Incorrect CAPTCHA. Please try again.')
      refreshCaptcha()
      return
    }

    setLoading(true)
    setError('')

    const input = form.email.trim()
    const isPhone = /^\d{10,}$/.test(input)

    const { error: signInError } = isPhone
      ? await supabase.auth.signInWithPassword({ phone: input, password: form.password })
      : await supabase.auth.signInWithPassword({ email: input, password: form.password })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      refreshCaptcha()
      return
    }

    // After signInWithPassword, Supabase writes session to cookies.
    // getSession() reads from cookies directly (no cache) so it picks up the new session immediately.
    // Then refresh to ensure the session is fully active before routing.
    let { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) console.error('Session error:', sessionError)

    if (!session?.user) {
      await supabase.auth.refreshSession()
      const { data: { session: retry } } = await supabase.auth.getSession()
      if (!retry?.user) { setError('Session expired. Please login again.'); setLoading(false); return }
      session = retry
    }

const user = session.user

    // ── Step 1: Check documents uploaded using user_id ──────────────────
    const { data: docs } = await supabase
      .from('shop_documents')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!docs) {
      // No docs yet → documents upload page
      window.location.href = '/login/shopkeeper/register/documents'
      return
    }

    // ── Step 2: Check if shop exists and is approved ──────────────────
    const { data: shop } = await supabase
      .from('shops')
      .select('id, is_approved, is_active')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!shop) {
      // No shop yet → redirect to register to create shop
      window.location.href = '/login/shopkeeper/register'
      return
    }

    // ── Step 3: Check approval status ────────────────────────────
    if (shop.is_approved && shop.is_active) {
      // Fully approved → dashboard
      window.location.href = '/shopkeeper'
      return
    }

    // Pending or rejected → status page
    window.location.href = '/login/status'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <img src="/logo.png" alt="VarunsOnline" style={{ width: 40, height: 40, objectFit: 'contain' }} />
      </div>

      <div style={{ flex: 1, padding: '0 24px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '2rem' }}>🏪</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Shop Owner</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Sign in to manage your shop</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input type="text" placeholder="Email or Phone Number" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required style={{ padding: '14px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white' }} />
          <div style={{ position: 'relative' }}>
            <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required style={{ width: '100%', padding: '14px 16px', paddingRight: 44, borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box' }} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {showPassword ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
            </button>
          </div>

          <CaptchaDisplay code={captcha} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Enter CAPTCHA"
              value={captchaInput}
              onChange={e => setCaptchaInput(e.target.value.toUpperCase())}
              maxLength={5}
              required
              style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white', letterSpacing: 4, fontWeight: 600, textTransform: 'uppercase' }}
            />
            <button type="button" onClick={refreshCaptcha} style={{ padding: '10px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', fontSize: '1.2rem' }}>🔄</button>
          </div>

          {error && <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: 10, color: '#dc2626', fontSize: '0.85rem', fontWeight: 500 }}>{error}</div>}

          <button type="button" onClick={() => { setResetEmail(form.email); setShowReset(true) }} style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center', marginBottom: -4 }}>Forgot Password?</button>

          <button type="submit" disabled={loading} style={{ padding: '16px', background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: 'white', border: 'none', borderRadius: 14, fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 16px rgba(14,165,233,0.3)' }}>
            {loading ? 'Please wait...' : 'Login'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Don&apos;t have an account? </span>
          <button onClick={() => router.push('/login/shopkeeper/register')} style={{ background: 'none', border: 'none', color: '#0ea5e9', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>Register</button>
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
              <button onClick={handleResetPassword} disabled={resetLoading} style={{ flex: 1, padding: '14px', background: resetLoading ? '#94a3b8' : '#0ea5e9', border: 'none', borderRadius: 12, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: resetLoading ? 'not-allowed' : 'pointer' }}>{resetLoading ? 'Sending...' : 'Send Link'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}