'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const VEHICLE_TYPES = ['Bike', 'Scooter', 'Bicycle', 'Car', 'EV Bike', 'Other']

const TERMS_AGENT = `DELIVERY AGENT TERMS & CONDITIONS

1. The delivery agent must provide genuine and accurate information during registration.

2. Uploading fake Aadhaar details, fake vehicle details, or false identity information may lead to permanent account suspension.

3. The delivery agent is fully responsible for the safety and timely delivery of customer orders.

4. Any theft, fraud, intentional order cancellation, fake delivery completion, or misuse of platform funds may result in permanent banning and legal action.

5. Delivery agents must behave professionally with customers, shopkeepers, and platform staff.

6. Misconduct, abusive behavior, threats, harassment, intoxicated driving, or unsafe behavior may result in immediate account suspension.

7. Cash collected from Cash on Delivery (COD) orders must be settled correctly to the platform without delay.

8. Repeated late deliveries, fake location activity, or intentional order delays may reduce delivery priority or lead to suspension.

9. The platform has the right to approve, reject, suspend, or terminate a delivery agent account at any time if suspicious activity is detected.

10. By registering, the delivery agent confirms all submitted details are true and agrees to platform verification and approval.`

const TERMS_SHOPKEEPER = `SHOPKEEPER TERMS & CONDITIONS

1. The shopkeeper must provide genuine and accurate information during registration.

2. Selling expired, damaged, duplicate, fake, unsafe, or poor-quality products is strictly prohibited.

3. If customers repeatedly receive damaged, expired, wrong, or low-quality products, strict action will be taken including warnings, temporary suspension, payment hold, or permanent account removal.

4. Fake product listings, misleading prices, false offers, or intentionally incorrect product information are strictly prohibited.

5. Shopkeepers must ensure all products are hygienic, safe, properly packed, and in good condition before handing over to delivery agents.

6. Intentional order cancellations after accepting orders, repeated delays, or bad order handling may reduce shop visibility or result in penalties.

7. The shopkeeper is responsible for maintaining correct stock availability and pricing.

8. Fraudulent activity, fake orders, scams, payment abuse, or misuse of the platform may lead to permanent banning and legal action.

9. Shopkeepers must treat customers, delivery agents, and platform staff professionally.

10. By registering, the shopkeeper confirms all submitted information is true and agrees to platform verification and admin approval.`

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userType, setUserType] = useState<'shopkeeper' | 'agent' | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    password: '',
    shop_name: '',
    vehicle_type: 'Bike',
    vehicle_number: '',
  })

  async function handleSubmit() {
    setError('')
    if (!userType) { setError('Please select Register as Shopkeeper or Agent'); return }
    if (!form.full_name.trim()) { setError('Full Name is required'); return }
    if (!form.email.trim()) { setError('Email is required'); return }
    if (!form.password.trim()) { setError('Password is required'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (!form.phone_number.trim()) { setError('Phone Number is required'); return }
    
    if (userType === 'agent') {
      if (!form.vehicle_type) { setError('Vehicle Type is required'); return }
      if (!form.vehicle_number.trim()) { setError('Vehicle Number is required'); return }
    }
    if (userType === 'shopkeeper') {
      if (!form.shop_name.trim()) { setError('Shop Name is required'); return }
    }
    if (!agreedToTerms) { setError('You must agree to the Terms & Conditions'); return }

    setSaving(true)

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { 
          data: { 
            full_name: form.full_name.trim(), 
            role: userType === 'agent' ? 'delivery_agent' : 'shopkeeper',
            phone: form.phone_number.trim()
          } 
        }
      })

      if (signUpError) { 
        setError('Registration failed: ' + signUpError.message); 
        setSaving(false); 
        return 
      }

      if (!signUpData.user) { 
        setError('Failed to create account'); 
        setSaving(false); 
        return 
      }

      if (userType === 'shopkeeper') {
        await supabase.from('shops').insert({
          owner_id: signUpData.user.id,
          full_name: form.full_name.trim(),
          phone: form.phone_number.trim(),
          email: form.email.trim(),
          name: form.shop_name.trim(),
          terms_accepted: true,
          is_approved: false,
          is_active: false,
        })
      } else {
        await supabase.from('delivery_agents').insert({
          id: signUpData.user.id,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone_number.trim(),
          vehicle_type: form.vehicle_type,
          vehicle_number: form.vehicle_number.trim().toUpperCase(),
          is_approved: false,
          terms_agreed: true,
        })
      }

      // Store user type for next step
      localStorage.setItem('registration_user_type', userType)
      localStorage.setItem('registration_user_id', signUpData.user.id)

      setSaving(false)
      router.push('/register-documents')
    } catch (err: any) {
      setError('Error: ' + err.message)
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '0 16px 40px' }}>
      <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          {userType === 'agent' ? 'Delivery Partner Registration' : userType === 'shopkeeper' ? 'Shopkeeper Registration' : 'Registration'}
        </h2>
      </div>

      {/* User Type Selection */}
      {!userType && (
        <div style={{ maxWidth: 500, margin: '0 auto 24px' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setUserType('shopkeeper')}
              style={{ 
                flex: 1, 
                padding: 20, 
                border: '2px solid #e2e8f0', 
                borderRadius: 16, 
                background: 'white',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏪</div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.1rem' }}>Shopkeeper</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Start selling online</div>
            </button>
            <button
              onClick={() => setUserType('agent')}
              style={{ 
                flex: 1, 
                padding: 20, 
                border: '2px solid #e2e8f0', 
                borderRadius: 16, 
                background: 'white',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🚚</div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.1rem' }}>Delivery Agent</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Deliver & earn</div>
            </button>
          </div>
        </div>
      )}

      {userType && (
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
            {/* Personal Details */}
            <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Personal Details</h3>
              
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Full Name (as per Aadhaar) *</label>
                <input 
                  value={form.full_name} 
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} 
                  placeholder="Enter your full name" 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} 
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email ID *</label>
                <input 
                  type="email" 
                  value={form.email} 
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
                  placeholder="your@email.com" 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} 
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={form.password} 
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} 
                    placeholder="Create a password" 
                    style={{ width: '100%', padding: '12px 14px', paddingRight: 44, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {showPassword ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Phone Number *</label>
                <input 
                  type="tel" 
                  value={form.phone_number} 
                  onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} 
                  placeholder="10-digit phone number" 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} 
                />
              </div>
            </div>

            {/* Shop Name for Shopkeeper / Vehicle Details for Agent */}
            {userType === 'shopkeeper' ? (
              <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Shop Details</h3>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Shop Name *</label>
                  <input 
                    value={form.shop_name} 
                    onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))} 
                    placeholder="e.g. Ravi General Store" 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} 
                  />
                </div>
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Vehicle Details</h3>
                
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Vehicle Type *</label>
                  <select 
                    value={form.vehicle_type} 
                    onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))} 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box', appearance: 'none', background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center, white` }}
                  >
                    {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Vehicle Number *</label>
                  <input 
                    value={form.vehicle_number} 
                    onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} 
                    placeholder="e.g. TS 01 AB 1234" 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box', textTransform: 'uppercase' }} 
                  />
                </div>
              </div>
            )}

            {/* Terms & Conditions */}
            <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Terms & Conditions *</h3>
              
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 12 }}>
                <input 
                  type="checkbox" 
                  checked={agreedToTerms} 
                  onChange={e => setAgreedToTerms(e.target.checked)} 
                  style={{ width: 20, height: 20, marginTop: 2, accentColor: userType === 'shopkeeper' ? '#f97316' : '#22c55e' }} 
                />
                <span style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.5 }}>
                  I have read and agree to the{' '}
                  <button 
                    type="button" 
                    onClick={() => setShowTerms(true)} 
                    style={{ background: 'none', border: 'none', color: userType === 'shopkeeper' ? '#f97316' : '#22c55e', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                  >
                    Terms & Conditions
                  </button>
                </span>
              </label>

              <button 
                type="button" 
                onClick={() => setShowTerms(true)} 
                style={{ width: '100%', padding: '12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
              >
                📄 View Terms & Conditions
              </button>
            </div>

            {error && (
              <div style={{ padding: 14, background: '#fef2f2', borderRadius: 12, color: '#dc2626', fontSize: '0.9rem', fontWeight: 600, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={saving} 
              style={{ 
                width: '100%', 
                padding: '16px', 
                background: saving ? '#94a3b8' : userType === 'shopkeeper' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', 
                color: 'white', 
                border: 'none', 
                borderRadius: 14, 
                fontSize: '1rem', 
                fontWeight: 700, 
                cursor: saving ? 'not-allowed' : 'pointer', 
                boxShadow: saving ? 'none' : userType === 'shopkeeper' ? '0 4px 16px rgba(249,115,22,0.3)' : '0 4px 16px rgba(34,197,94,0.3)'
              }}
            >
              {saving ? 'Submitting...' : 'Submit Registration'}
            </button>

            <button 
              type="button"
              onClick={() => setUserType(null)} 
              style={{ width: '100%', padding: 12, background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', cursor: 'pointer', marginTop: 8 }}
            >
              ← Change Registration Type
            </button>
          </form>
        </div>
      )}

      {/* Terms Modal */}
      {showTerms && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowTerms(false)}>
          <div style={{ background: 'white', width: '100%', maxWidth: 500, margin: '0 auto', borderRadius: '20px 20px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>📋 Terms & Conditions</h3>
              <button onClick={() => setShowTerms(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 20, whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: '#374151', lineHeight: 1.7 }}>
              {userType === 'agent' ? TERMS_AGENT : TERMS_SHOPKEEPER}
            </div>
            <div style={{ padding: 16, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12 }}>
              <button onClick={() => setShowTerms(false)} style={{ flex: 1, padding: '14px', background: '#f1f5f9', border: 'none', borderRadius: 12, color: '#475569', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { setAgreedToTerms(true); setShowTerms(false) }} style={{ flex: 1, padding: '14px', background: userType === 'shopkeeper' ? '#f97316' : '#22c55e', border: 'none', borderRadius: 12, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}>
                ✅ I Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}