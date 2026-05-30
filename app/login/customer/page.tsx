'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
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

export default function CustomerLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const mountedRef = useRef(false)
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => { mountedRef.current = true }, [])
  
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', full_name: '', phone: '', gender: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [captcha, setCaptcha] = useState(() => generateCaptcha())
  const [captchaInput, setCaptchaInput] = useState('')
  const [checkingExisting, setCheckingExisting] = useState(false)
  const [existingMessage, setExistingMessage] = useState('')

  // Real-time existing user detection during registration
  const checkExistingUser = useCallback(async (phone: string, email: string) => {
    if (isLogin || (!phone.trim() && !email.trim())) {
      setExistingMessage('')
      return
    }
    
    setCheckingExisting(true)
    setExistingMessage('')
    
    try {
      const searchValue = phone.trim() || email.trim()
      if (!searchValue) {
        setCheckingExisting(false)
        return
      }
      
      const isPhone = /^\d{10,}$/.test(searchValue)
      
      // Use server-side API to bypass RLS
      const checkRes = await fetch('/api/auth/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          [isPhone ? 'phone' : 'email']: searchValue
        }),
      })
      const checkData = await checkRes.json()
      
      if (!mountedRef.current) return
      
      if (checkData.exists) {
        setExistingMessage('Note: An account already exists with this information. If this is you, please switch to Login.')
      }
    } catch (err) {
      console.error('Error checking existing user:', err)
    } finally {
      if (mountedRef.current) {
        setCheckingExisting(false)
      }
    }
  }, [isLogin])

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    
    if (!isLogin) {
      debounceTimeout.current = setTimeout(() => {
        checkExistingUser(form.phone, form.email)
      }, 500)
    } else {
      setExistingMessage('')
    }

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    }
  }, [form.phone, form.email, isLogin, checkExistingUser])

  async function refreshCaptcha() {
    setCaptcha(generateCaptcha())
    setCaptchaInput('')
  }

  async function handleResetPassword() {
    if (!resetEmail.trim()) { setResetMessage('Please enter your email'); return }
    setResetLoading(true)
    setResetMessage('')
    // Must go through /auth/callback so the PKCE code is exchanged for a
    // real session before the user lands on /reset-password.
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://www.varunsonline.com'
      : window.location.origin
    const redirectUrl = `${baseUrl}/auth/callback?next=/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), { redirectTo: redirectUrl })
    if (error) { setResetMessage(error.message); setResetLoading(false); return }
    setResetMessage('Password reset link sent to your email!')
    setResetLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Validate captcha
    if (captchaInput.toUpperCase() !== captcha) {
      setError('Incorrect CAPTCHA. Please try again.')
      refreshCaptcha()
      return
    }

    setLoading(true)
    setError('')

    const input = form.email.trim()
    
    if (!isLogin) {
      // Validate confirm password for registration
      if (!form.confirmPassword.trim()) { setError('Please confirm your password'); setLoading(false); return }
      if (form.password !== form.confirmPassword) { setError('Passwords do not match. Please re-enter.'); setLoading(false); return }
    }
    
    if (isLogin) {
      const digitsOnly = input.replace(/\D/g, '')
      const isPhone = /^\d{10,}$/.test(digitsOnly)
      let emailToAuth = input
      
      if (isPhone) {
        // Use server-side API to bypass RLS on profiles table
        const lookupRes = await fetch('/api/auth/phone-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: digitsOnly }),
        })
        const lookupData = await lookupRes.json()

        if (lookupRes.ok && lookupData.email) {
          emailToAuth = lookupData.email
        } else {
          setError(lookupData.error || 'No customer account found with this phone number.')
          setLoading(false)
          refreshCaptcha()
          return
        }
      }

      const { error } = await supabase.auth.signInWithPassword({ email: emailToAuth, password: form.password })
      if (error) { setError(error.message); setLoading(false); refreshCaptcha(); return }
      router.push('/customer')
    } else {
      // Check if user already exists before signup
      const isPhone = /^\d{10,}$/.test(input)
      const searchValue = isPhone ? form.phone.trim() : input
      
      if (searchValue) {
        // Use server-side API to bypass RLS
        const checkRes = await fetch('/api/auth/check-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            [isPhone ? 'phone' : 'email']: searchValue
          }),
        })
        const checkData = await checkRes.json()
        
        if (checkData.exists) {
          setError('An account with this information already exists. Please login to continue.')
          setLoading(false)
          setIsLogin(true)
          return
        }
      }
      
      const { data, error: signUpError } = await supabase.auth.signUp({ 
        email: form.email, 
        password: form.password, 
        options: { data: { full_name: form.full_name, phone: form.phone, role: 'customer' } } 
      })
      
      // Handle "user already registered" error gracefully
      if (signUpError) {
        const errorMsg = signUpError.message.toLowerCase()
        if (errorMsg.includes('already registered') || errorMsg.includes('already exists') || errorMsg.includes('user already exists')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: form.email,
            password: form.password
          })
          
          if (signInData?.user) {
            const { data: customer } = await supabase.from('customers').select('id').eq('id', signInData.user.id).single()
            if (customer) {
              router.push('/customer')
              setLoading(false)
              return
            }
          }
          
          if (signInError) {
            setError('Account exists. Please login with your existing credentials.')
            setLoading(false)
            setIsLogin(true)
            return
          }
        }
        
        setError(signUpError.message)
        setLoading(false)
        refreshCaptcha()
        return
      }
      
      if (data.user) { 
        // Create customer record
        await supabase.from('customers').insert({ id: data.user.id })
        // Update phone in profiles (auto-trigger doesn't save phone from metadata)
        await supabase.from('profiles').update({
          phone: form.phone.replace(/\D/g, ''),
        }).eq('id', data.user.id)

        // Auto sign-in if no session returned (like shopkeeper/delivery flows)
        if (!data.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: form.email,
            password: form.password,
          })
          if (signInError) {
            setError('Account created but auto-login failed. Please login manually.')
            setLoading(false)
            setIsLogin(true)
            return
          }
        }

        router.push('/customer')
      }
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
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '2rem' }}>🛒</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{isLogin ? 'Customer Login' : 'Customer Register'}</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{isLogin ? 'Sign in to continue shopping' : 'Create an account to start shopping'}</p>
        </div>

        {existingMessage && (
          <div style={{ 
            padding: 12, 
            borderRadius: 10, 
            background: '#fffbeb',
            color: '#b45309',
            border: '1px solid #fde68a',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: 8
          }}>
            ⚠️ {existingMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isLogin && (
            <>
              <input type="text" placeholder="Full Name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required style={{ padding: '14px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white' }} />
              <input type="tel" placeholder="Phone Number" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required style={{ padding: '14px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white' }} />
              <select 
                value={form.gender} 
                onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                required
                style={{ padding: '14px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white', appearance: 'none' }}
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </>
          )}
          <input type="text" placeholder="Email or Phone Number" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required style={{ padding: '14px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white' }} />
          <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required style={{ width: '100%', padding: '14px 16px', paddingRight: 44, borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {showPassword ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>

          {!isLogin && (
            <div style={{ paddingBottom: form.confirmPassword ? 22 : 0 }}>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm Password"
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  required
                  style={{
                    width: '100%', padding: '14px 16px', paddingRight: 44,
                    borderRadius: 12,
                    border: `1.5px solid ${form.confirmPassword && form.password !== form.confirmPassword ? '#ef4444' : form.confirmPassword && form.password === form.confirmPassword ? '#22c55e' : '#e2e8f0'}`,
                    fontSize: '0.95rem', background: 'white', boxSizing: 'border-box'
                  }}
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {showConfirmPassword ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <div style={{ marginTop: 5, fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>⚠️ Passwords do not match</div>
              )}
              {form.confirmPassword && form.password === form.confirmPassword && (
                <div style={{ marginTop: 5, fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>✅ Passwords match</div>
              )}
            </div>
          )}

          {/* CAPTCHA for both login and register */}
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

          {isLogin && (
            <button type="button" onClick={() => { setResetEmail(form.email); setShowReset(true) }} style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center', marginBottom: -4 }}>Forgot Password?</button>
          )}

          <button type="submit" disabled={loading} style={{ padding: '16px', background: loading ? '#94a3b8' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: 'white', border: 'none', borderRadius: 14, fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 16px rgba(249,115,22,0.3)' }}>
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{isLogin ? "Don't have an account?" : 'Already have an account?'} </span>
          <button onClick={() => { setIsLogin(!isLogin); setError(''); setForm(f => ({ ...f, confirmPassword: '' })) }} style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>{isLogin ? 'Register' : 'Login'}</button>
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
              <button onClick={handleResetPassword} disabled={resetLoading} style={{ flex: 1, padding: '14px', background: resetLoading ? '#94a3b8' : '#f97316', border: 'none', borderRadius: 12, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: resetLoading ? 'not-allowed' : 'pointer' }}>{resetLoading ? 'Sending...' : 'Send Link'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}