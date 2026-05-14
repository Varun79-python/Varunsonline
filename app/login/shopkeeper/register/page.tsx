'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TERMS_TEXT = `### Shopkeeper Terms & Conditions`

// Check if user is already logged in and redirect to appropriate page
async function checkExistingSession(supabase: any, router: any) {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    // Check if shop exists
    const { data: shop } = await supabase
      .from('shops')
      .select('id, is_approved, is_active')
      .eq('owner_id', session.user.id)
      .maybeSingle()

    if (shop) {
      // Check if documents uploaded
      const { data: docs } = await supabase
        .from('shop_documents')
        .select('id')
        .eq('shop_id', shop.id)
        .maybeSingle()

      if (!docs) {
        router.replace('/login/shopkeeper/register/documents')
        return
      }

      if (shop.is_approved && shop.is_active) {
        router.replace('/shopkeeper')
        return
      }

      router.replace('/login/status')
      return
    }
  }
}

1. The shopkeeper must provide genuine and accurate information during registration.
2. Selling expired, damaged, duplicate, fake, unsafe, or poor-quality products is strictly prohibited.
3. If customers repeatedly receive damaged, expired, wrong, or low-quality products, strict action will be taken.
4. Fake product listings, misleading prices, false offers are strictly prohibited.
5. Shopkeepers must ensure all products are hygienic, safe, properly packed.
6. Intentional order cancellations may reduce shop visibility or result in penalties.
7. The shopkeeper is responsible for maintaining correct stock availability and pricing.
8. Fraudulent activity may lead to permanent banning and legal action.
9. Shopkeepers must treat customers, delivery agents professionally.
10. Misconduct, abusive language may result in account suspension.
11. The platform has the right to approve, reject, suspend any shopkeeper account.
12. Shops must comply with local laws and business regulations.
13. Repeated poor ratings may disable the shop.
14. By registering, the shopkeeper agrees to platform verification and admin approval.`

export default function ShopRegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [showLoginPopup, setShowLoginPopup] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(false)
  const [existingUserMessage, setExistingUserMessage] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    password: '',
    shop_name: '',
    terms_accepted: false,
  })

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)

  // Check existing session on mount
  useEffect(() => {
    checkExistingSession(supabase, router)
  }, [supabase, router])

  const checkExistingUser = useCallback(async (phone: string, email: string) => {
    if (!phone.trim() && !email.trim()) return
    
    setCheckingExisting(true)
    setExistingUserMessage('')
    
    try {
      const { data: existingShop } = await supabase
        .from('shops')
        .select('*')
        .eq('phone', phone.trim())
        .maybeSingle()

      if (existingShop) {
        if (existingShop.is_approved) {
          setExistingUserMessage('Account already exists and approved. Redirecting to login...')
          setTimeout(() => router.push('/login/shopkeeper'), 1500)
          return
        }
        
        setForm(f => ({
          ...f,
          full_name: existingShop.full_name || f.full_name,
          phone_number: existingShop.phone || f.phone_number,
          email: existingShop.email || f.email,
          shop_name: existingShop.name || f.shop_name,
        }))
        setExistingUserMessage('Partial registration found. Please login to continue.')
        setCheckingExisting(false)
        return
      }
    } catch (err) {
      console.error('Error checking existing user:', err)
    } finally {
      setCheckingExisting(false)
    }
  }, [supabase, router])

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    
    debounceTimeout.current = setTimeout(() => {
      checkExistingUser(form.phone_number, form.email)
    }, 500)

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    }
  }, [form.phone_number, form.email, checkExistingUser])

  async function submit() {
    if (!form.full_name.trim()) { alert('Please enter Full Name'); return }
    if (!form.phone_number.trim()) { alert('Please enter Phone Number'); return }
    if (!form.email.trim()) { alert('Please enter Email'); return }
    if (!form.password.trim()) { alert('Please enter Password'); return }
    if (form.password.length < 6) { alert('Password must be at least 6 characters'); return }
    if (!form.shop_name.trim()) { alert('Please enter Shop Name'); return }
    if (!form.terms_accepted) { alert('Please accept Terms & Conditions'); return }

    setSaving(true)
    
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name.trim(), role: 'shopkeeper' } }
      })
      
      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered') || signUpError.message.toLowerCase().includes('already exists')) {
          alert('An account with this email already exists. Please login.')
          setSaving(false)
          return
        }
        alert('Registration failed: ' + signUpError.message)
        setSaving(false)
        return
      }

      if (!signUpData.user) {
        alert('Failed to create account')
        setSaving(false)
        return
      }

      const { data: shopData, error: shopError } = await supabase.from('shops').insert({
        owner_id: signUpData.user.id,
        full_name: form.full_name.trim(),
        phone: form.phone_number.trim(),
        email: form.email.trim(),
        name: form.shop_name.trim(),
        terms_accepted: true,
        is_approved: false,
        is_active: false,
      }).select().single()

      if (shopError) { alert(shopError.message); setSaving(false); return }

      setShowLoginPopup(true)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (showLoginPopup) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', background: 'white', padding: 40, borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxWidth: 400 }}>
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>🔐</div>
        <h2 style={{ marginBottom: 12, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Login to Complete Registration</h2>
        <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
          Your basic details have been saved.<br/>
          Please login to upload your documents and complete registration.
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
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' }}>
      {showTerms && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: 16, fontSize: '1.25rem', fontWeight: 700 }}>Terms & Conditions</h3>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#374151', lineHeight: 1.6, marginBottom: 24 }}>{TERMS_TEXT}</div>
            <button onClick={() => { setForm(f => ({ ...f, terms_accepted: true })); setShowTerms(false) }} style={{ width: '100%', padding: 14, background: '#22c55e', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
              I Agree
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏪</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Shopkeeper Registration</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Step 1: Personal Details</p>
        </div>

        {(checkingExisting || existingUserMessage) && (
          <div style={{ 
            padding: 14, 
            borderRadius: 12, 
            marginBottom: 16,
            background: existingUserMessage.includes('Redirecting') ? '#dcfce7' : '#fef3c7',
            color: existingUserMessage.includes('Redirecting') ? '#16a34a' : '#92400e',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}>
            {checkingExisting ? (
              <><span style={{ animation: 'spin 1s linear infinite' }}>⏳</span> Checking...</>
            ) : (
              <>✅ {existingUserMessage}</>
            )}
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Full Name *</label>
              <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Enter your full name" style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Phone Number *</label>
              <input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="10-digit mobile number" style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email ID *</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="your@email.com" type="email" style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password *</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Create a password (min 6 chars)" style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Shop Name *</label>
              <input value={form.shop_name} onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))} placeholder="e.g. Ravi General Store" style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.terms_accepted} onChange={e => setForm(f => ({ ...f, terms_accepted: e.target.checked }))} style={{ width: 20, height: 20, marginTop: 2 }} />
                <span style={{ fontSize: '0.85rem', color: '#374151' }}>
                  I have read and agree to the{' '}
                  <button type="button" onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: '#f97316', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Terms & Conditions</button>
                </span>
              </label>
            </div>

            <button onClick={submit} disabled={saving} style={{ padding: 16, background: saving ? '#94a3b8' : '#f97316', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Submitting...' : 'Next Step →'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/login/shopkeeper" style={{ color: '#64748b', fontSize: '0.9rem' }}>← Back to Login</a>
        </div>
      </div>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}