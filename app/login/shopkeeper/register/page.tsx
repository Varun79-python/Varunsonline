'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ShopRegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showLoginPopup, setShowLoginPopup] = useState(false)
  const [isExistingAuth, setIsExistingAuth] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(false)
  const [existingUserMessage, setExistingUserMessage] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    password: '',
    gender: '',
  })
  const [error, setError] = useState('')
  const [showTerms, setShowTerms] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)

  const TERMS = `SHOPKEEPER TERMS & CONDITIONS

1. Shopkeepers must provide genuine business information during registration.

2. Uploading fake shop photos, fake documents, or false business information may lead to permanent account suspension.

3. Shopkeepers are fully responsible for order fulfillment and product quality.

4. Any fraud, counterfeit products, or misuse of platform may result in permanent banning and legal action.

5. Shopkeepers must behave professionally with customers and delivery partners.

6. Misconduct, abusive behavior, or harassment may result in immediate account suspension.

7. Platform has the right to approve, reject, suspend, or terminate shopkeeper account at any time.

8. By registering, shopkeeper confirms all submitted details are true and agrees to platform verification.`

  const checkExistingUser = useCallback(async (phone: string, email: string) => {
    if (!phone.trim() && !email.trim()) return

    setCheckingExisting(true)
    setExistingUserMessage('')

    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'shopkeeper')
        .or(`phone.eq.${phone.trim()},email.eq.${email.trim()}`)
        .maybeSingle()

      if (existingProfile) {
        setExistingUserMessage('Note: An account with this phone/email already exists. If this is you, please log in.')
        return
      }
    } catch (err) {
      console.error('Error checking existing user:', err)
    } finally {
      setCheckingExisting(false)
    }
  }, [supabase])

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    debounceTimeout.current = setTimeout(() => {
      checkExistingUser(form.phone_number, form.email)
    }, 500)
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current) }
  }, [form.phone_number, form.email, checkExistingUser])

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setIsExistingAuth(true)
        setForm(f => ({
          ...f,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || '',
        }))
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (profile) {
          setForm(f => ({
            ...f,
            full_name: profile.full_name || f.full_name,
            phone_number: profile.phone || f.phone_number,
            gender: profile.gender || f.gender,
          }))
        }
      }
      setLoading(false)
    }
    checkAuth()
  }, [])

  async function submit() {
    if (!form.full_name.trim()) { setError('Please enter Full Name'); return }
    if (!form.phone_number.trim()) { setError('Please enter Phone Number'); return }
    if (!form.email.trim()) { setError('Please enter Email'); return }
    if (!isExistingAuth && !form.password.trim()) { setError('Please enter Password'); return }
    if (!isExistingAuth && form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (!form.gender) { setError('Please select Gender'); return }
    if (!agreedToTerms) { setError('Please agree to Terms & Conditions'); return }

    setSaving(true)
    setError('')

    try {
      let userId = ''
      let needsLogin = false

      if (!isExistingAuth) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: { data: { full_name: form.full_name.trim(), role: 'shopkeeper', gender: form.gender } }
        })

        if (signUpError) {
          if (signUpError.message.toLowerCase().includes('already registered') || signUpError.message.toLowerCase().includes('already exists')) {
            setError('An account with this email already exists. Please login.')
            setSaving(false)
            return
          }
          setError('Registration failed: ' + signUpError.message)
          setSaving(false)
          return
        }

        if (!signUpData.user) {
          setError('Failed to create account')
          setSaving(false)
          return
        }
        userId = signUpData.user.id
        // If no session returned (email confirmation required), user needs to login first
        needsLogin = !signUpData.session
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setError('Session expired. Please login again.')
          setSaving(false)
          return
        }
        userId = user.id
      }

      // Save profile only — shop is created by admin after document approval
      await supabase.from('profiles').upsert({
        id: userId,
        full_name: form.full_name.trim(),
        phone: form.phone_number.trim(),
        email: form.email.trim(),
        role: 'shopkeeper',
        gender: form.gender,
      })

      if (needsLogin) {
        // Email confirmation or session not returned — show login popup
        setShowLoginPopup(true)
      } else {
        // Already have session → go directly to document upload
        router.push('/login/shopkeeper/register/documents')
      }
    } catch (err: unknown) {
      setError('Error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (showLoginPopup) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', background: 'white', padding: 40, borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxWidth: 400 }}>
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>🔐</div>
        <h2 style={{ marginBottom: 12, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Login to Upload Documents</h2>
        <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
          Your basic details have been saved.<br/>
          Please login to upload your shop documents and complete registration.
        </p>
        <button
          onClick={() => router.push('/login/shopkeeper')}
          style={{ padding: '14px 32px', background: '#f97316', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', width: '100%' }}
        >
          🔑 Login to Continue
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '0 16px 40px' }}>
      <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/login/shopkeeper')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Shop Owner Registration</h2>
      </div>

      {(checkingExisting || existingUserMessage) && (
        <div style={{
          padding: 14,
          borderRadius: 12,
          marginBottom: 16,
          background: '#fffbeb',
          color: '#b45309',
          border: '1px solid #fde68a',
          fontSize: '0.85rem',
          fontWeight: 600,
          maxWidth: 500,
          margin: '0 auto 16px'
        }}>
          {checkingExisting ? <>⏳ Checking...</> : <>⚠️ {existingUserMessage}</>}
        </div>
      )}

      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Step 1: Personal Details</h3>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Full Name *</label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Enter your full name" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Phone Number *</label>
            <input type="tel" value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="10-digit phone number" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email ID *</label>
            <input type="email" value={form.email} readOnly={isExistingAuth} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="your@email.com" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box', background: isExistingAuth ? '#f1f5f9' : 'white' }} />
          </div>

          {!isExistingAuth && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password *</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Create a password (min 6 chars)" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Gender *</label>
            <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box', appearance: 'none', background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center, white` }}>
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Terms & Conditions *</h3>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 12 }}>
            <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2, accentColor: '#f97316' }} />
            <span style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.5 }}>
              I have read and agree to the <button type="button" onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Terms & Conditions</button>
            </span>
          </label>

          <button type="button" onClick={() => setShowTerms(true)} style={{ width: '100%', padding: '12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
            📄 View Terms & Conditions
          </button>
        </div>

        {error && <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: 10, color: '#dc2626', fontSize: '0.85rem', fontWeight: 500, marginBottom: 16 }}>{error}</div>}

        <button onClick={submit} disabled={saving} style={{ width: '100%', padding: '16px', background: saving ? '#94a3b8' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: 'white', border: 'none', borderRadius: 14, fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 4px 16px rgba(249,115,22,0.3)' }}>
          {saving ? 'Please wait...' : 'Next Step →'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Already have an account? </span>
          <button onClick={() => router.push('/login/shopkeeper')} style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>Login</button>
        </div>
      </div>

      {showTerms && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowTerms(false)}>
          <div style={{ background: 'white', width: '100%', maxWidth: 500, margin: '0 auto', borderRadius: '20px 20px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>📋 Terms & Conditions</h3>
              <button onClick={() => setShowTerms(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 20, whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: '#374151', lineHeight: 1.7 }}>
              {TERMS}
            </div>
            <div style={{ padding: 16, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12 }}>
              <button onClick={() => setShowTerms(false)} style={{ flex: 1, padding: '14px', background: '#f1f5f9', border: 'none', borderRadius: 12, color: '#475569', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { setAgreedToTerms(true); setShowTerms(false) }} style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', border: 'none', borderRadius: 12, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}>
                ✅ I Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}