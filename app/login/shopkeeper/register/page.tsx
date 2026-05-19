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

export default function ShopRegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    password: '',
    shop_name: '',
    gender: '',
  })
  const [error, setError] = useState('')
  const [captcha, setCaptcha] = useState(() => generateCaptcha())
  const [captchaInput, setCaptchaInput] = useState('')
  const [showTerms, setShowTerms] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  async function refreshCaptcha() {
    setCaptcha(generateCaptcha())
    setCaptchaInput('')
  }

  async function submit() {
    if (!form.full_name.trim()) { setError('Please enter Full Name'); return }
    if (!form.phone_number.trim()) { setError('Please enter Phone Number'); return }
    if (!form.email.trim()) { setError('Please enter Email'); return }
    if (!form.password.trim()) { setError('Please enter Password'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (!form.shop_name.trim()) { setError('Please enter Shop Name'); return }
    if (!form.gender) { setError('Please select Gender'); return }
    if (!agreedToTerms) { setError('Please agree to Terms & Conditions'); return }

    if (captchaInput.toUpperCase() !== captcha) {
      setError('Incorrect CAPTCHA. Please try again.')
      refreshCaptcha()
      return
    }

    setSaving(true)
    setError('')
    
    try {
      // Sign up user
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

      const userId = signUpData.user.id

      // Create profile with gender
      await supabase.from('profiles').upsert({
        id: userId,
        full_name: form.full_name.trim(),
        phone: form.phone_number.trim(),
        role: 'shopkeeper',
        gender: form.gender,
      })

      // Create shop
      await supabase.from('shops').insert({
        owner_id: userId,
        full_name: form.full_name.trim(),
        phone: form.phone_number.trim(),
        email: form.email.trim(),
        name: form.shop_name.trim(),
        is_approved: false,
        is_active: false,
      })

      // Sign in the user
      await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      })

      // Redirect to document upload page
      router.push('/login/shopkeeper/register/documents')
    } catch (err: any) {
      setError('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/login/shopkeeper')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <img src="/logo.png" alt="VarunsOnline" style={{ width: 40, height: 40, objectFit: 'contain' }} />
      </div>

      <div style={{ flex: 1, padding: '0 24px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '2rem' }}>🏪</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Register Your Shop</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Create your shop account to start selling</p>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Personal Details</h3>
          
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
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="your@email.com" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password *</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Create a password" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>

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
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Shop Details</h3>
          
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Shop Name *</label>
            <input value={form.shop_name} onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))} placeholder="Enter your shop name" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Terms & Conditions *</h3>
          
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 12 }}>
            <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2, accentColor: '#0ea5e9' }} />
            <span style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.5 }}>
              I have read and agree to the <button type="button" onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: '#0ea5e9', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Terms & Conditions</button>
            </span>
          </label>

          <button type="button" onClick={() => setShowTerms(true)} style={{ width: '100%', padding: '12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
            📄 View Terms & Conditions
          </button>
        </div>

        <CaptchaDisplay code={captcha} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Enter CAPTCHA"
            value={captchaInput}
            onChange={e => setCaptchaInput(e.target.value.toUpperCase())}
            maxLength={5}
            style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white', letterSpacing: 4, fontWeight: 600, textTransform: 'uppercase' }}
          />
          <button type="button" onClick={refreshCaptcha} style={{ padding: '10px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', fontSize: '1.2rem' }}>🔄</button>
        </div>

        {error && <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: 10, color: '#dc2626', fontSize: '0.85rem', fontWeight: 500, marginBottom: 16 }}>{error}</div>}

        <button onClick={submit} disabled={saving} style={{ padding: '16px', background: saving ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: 'white', border: 'none', borderRadius: 14, fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 4px 16px rgba(14,165,233,0.3)' }}>
          {saving ? 'Please wait...' : 'Register Shop'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Already have an account? </span>
          <button onClick={() => router.push('/login/shopkeeper')} style={{ background: 'none', border: 'none', color: '#0ea5e9', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>Login</button>
        </div>
      </div>

      {showTerms && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowTerms(false)}>
          <div style={{ background: 'white', borderRadius: 20, padding: 24, maxWidth: 500, width: '100%', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>Terms & Conditions</h3>
            <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
{'SHOPKEEPER TERMS & CONDITIONS\n\n1. Shopkeepers must provide genuine business information during registration.\n\n2. Uploading fake shop photos, fake documents, or false business information may lead to permanent account suspension.\n\n3. Shopkeepers are fully responsible for order fulfillment and product quality.\n\n4. Any fraud, counterfeit products, or misuse of platform may result in permanent banning and legal action.\n\n5. Shopkeepers must behave professionally with customers and delivery partners.\n\n6. Misconduct, abusive behavior, or harassment may result in immediate account suspension.\n\n7. Platform has the right to approve, reject, suspend, or terminate shopkeeper account at any time.\n\n8. By registering, shopkeeper confirms all submitted details are true and agrees to platform verification.'}
            </div>
            <button onClick={() => setShowTerms(false)} style={{ marginTop: 16, width: '100%', padding: '14px', background: '#0ea5e9', border: 'none', borderRadius: 12, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}