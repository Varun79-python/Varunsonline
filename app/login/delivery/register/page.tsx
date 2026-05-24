'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const VEHICLE_TYPES = ['Bike', 'Scooter', 'Bicycle', 'EV Bike']

export default function DeliveryRegisterPage() {
  const supabase = createClient()
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    vehicle_type: 'Bike',
    vehicle_number: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showLoginPopup, setShowLoginPopup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isExistingAuth, setIsExistingAuth] = useState(false)
  const [formError, setFormError] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(false)
  const [existingUserMessage, setExistingUserMessage] = useState('')

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)

  const checkExistingUser = useCallback(async (phone: string, email: string) => {
    if (!phone.trim() && !email.trim()) return
    
    setCheckingExisting(true)
    setExistingUserMessage('')
    
    try {
      const { data: existingAgent } = await supabase
        .from('delivery_agents')
        .select('*')
        .eq('phone', phone.trim())
        .maybeSingle()

      if (existingAgent) {
        if (existingAgent.is_approved) {
          setExistingUserMessage('Note: An approved delivery agent account already exists with this phone number. If this is you, please log in.')
          return
        }
        
        setExistingUserMessage('Note: A partial registration already exists with this phone number.')
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
      checkExistingUser(form.phone, form.email)
    }, 500)

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    }
  }, [form.phone, form.email, checkExistingUser])

  const TERMS = `DELIVERY AGENT TERMS & CONDITIONS

1. The delivery agent must provide genuine and accurate information during registration.
2. Uploading fake Aadhaar details may lead to permanent account suspension.
3. The delivery agent is fully responsible for the safety and timely delivery of customer orders.
4. Any theft, fraud, intentional order cancellation may result in permanent banning.
5. Delivery agents must behave professionally with customers and shopkeepers.
6. Misconduct, abusive behavior may result in immediate account suspension.
7. Cash collected from COD orders must be settled correctly.
8. Repeated late deliveries may reduce delivery priority or lead to suspension.
9. The platform has the right to approve, reject, suspend any delivery agent account.
10. Vehicle documents must belong to the registered delivery agent.
11. The delivery agent is responsible for obeying traffic rules.
12. The platform is not responsible for accidents or personal losses during delivery.
13. By registering, the delivery agent agrees to platform verification and approval.`

  useEffect(() => {
    async function prefill() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setIsExistingAuth(true)
        setForm(f => ({ 
          ...f, 
          email: user.email || '',
          full_name: user.user_metadata?.full_name || f.full_name
        }))
        
        // Also fetch from profiles if available
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (profile) {
          setForm(f => ({
            ...f,
            full_name: profile.full_name || f.full_name,
            phone: profile.phone || f.phone,
          }))
        }
      }
      setLoading(false)
    }
    prefill()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!form.full_name.trim()) { setFormError('Full Name is required'); return }
    if (!form.email.trim()) { setFormError('Email is required'); return }
    if (!form.phone.trim()) { setFormError('Phone Number is required'); return }
    if (!form.password.trim()) { setFormError('Password is required'); return }
    if (form.password.length < 6) { setFormError('Password must be at least 6 characters'); return }
    if (!form.confirmPassword.trim()) { setFormError('Please confirm your password'); return }
    if (form.password !== form.confirmPassword) { setFormError('Passwords do not match. Please re-enter.'); return }
    if (!form.vehicle_type) { setFormError('Vehicle Type is required'); return }
    if (!form.vehicle_number.trim() && form.vehicle_type !== 'Bicycle') { setFormError('Vehicle Number is required'); return }
    if (!agreedToTerms) { setFormError('You must agree to the Terms & Conditions'); return }

    setSaving(true)
    
    try {
      let userId = ''
      
      if (!isExistingAuth) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: { data: { full_name: form.full_name.trim(), role: 'delivery_agent' } }
        })
        
        if (signUpError) {
          if (signUpError.message.toLowerCase().includes('already registered') || signUpError.message.toLowerCase().includes('already exists')) {
            setFormError('An account with this email already exists. Please login.')
            setSaving(false)
            return
          }
          setFormError(signUpError.message); setSaving(false); return
        }

        if (!signUpData.user) { setFormError('Failed to create account'); setSaving(false); return }
        userId = signUpData.user.id
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setFormError('Session expired. Please login again.'); setSaving(false); return }
        userId = user.id
      }

      const { error: agentError } = await supabase.from('delivery_agents').upsert({
        id: userId,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.replace(/\D/g, ''),
        vehicle_type: form.vehicle_type,
        vehicle_number: form.vehicle_number.trim().toUpperCase(),
        is_approved: false,
        is_active: false,
        rejection_reason: null,
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' })

      if (agentError) { setFormError('Failed to submit: ' + agentError.message); setSaving(false); return }
      
      if (!isExistingAuth) {
        setShowLoginPopup(true)
      } else {
        router.push('/login/delivery/register/documents')
      }
    } catch (err: unknown) {
      setFormError('Error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

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
          onClick={() => router.push('/login/delivery')} 
          style={{ padding: '14px 32px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', width: '100%' }}
        >
          🔑 Login to Continue
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '0 16px 40px' }}>
      <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/login/delivery')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Delivery Partner Registration</h2>
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
          {checkingExisting ? (
            <><span style={{ animation: 'spin 1s linear infinite' }}>⏳</span> Checking...</>
          ) : (
            <>⚠️ {existingUserMessage}</>
          )}
        </div>
      )}

      <form onSubmit={submit} style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Step 1: Personal Details</h3>
          
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Full Name *</label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Enter your full name" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email ID *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="your@email.com" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box', background: 'white' }} />
            {isExistingAuth && form.email && (
              <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, padding: '6px 10px' }}>
                💡 Pre-filled from your account — you can change it if needed
              </div>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Create a password (min 6 chars)"
                    style={{ width: '100%', padding: '12px 14px', paddingRight: 44, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {showPassword
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Confirm Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Re-enter your password"
                    style={{
                      width: '100%', padding: '12px 14px', paddingRight: 44, borderRadius: 10,
                      border: `1.5px solid ${form.confirmPassword && form.password !== form.confirmPassword ? '#ef4444' : form.confirmPassword && form.password === form.confirmPassword ? '#22c55e' : '#e2e8f0'}`,
                      fontSize: '0.95rem', boxSizing: 'border-box'
                    }}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {showConfirmPassword
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <div style={{ marginTop: 5, fontSize: '0.78rem', color: '#ef4444', fontWeight: 600 }}>⚠️ Passwords do not match</div>
                )}
                {form.confirmPassword && form.password === form.confirmPassword && (
                  <div style={{ marginTop: 5, fontSize: '0.78rem', color: '#22c55e', fontWeight: 600 }}>✅ Passwords match</div>
                )}
              </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Phone Number *</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit phone number" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Vehicle Details</h3>
          
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Vehicle Type *</label>
            <select value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))} style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box', appearance: 'none', background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center, white` }}>
              {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Vehicle Number *</label>
            <input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="e.g. TS 01 AB 1234" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box', textTransform: 'uppercase' }} />
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Terms & Conditions *</h3>
          
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 12 }}>
            <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2, accentColor: '#22c55e' }} />
            <span style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.5 }}>
              I have read and agree to the <button type="button" onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: '#22c55e', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Terms & Conditions</button>
            </span>
          </label>

          <button type="button" onClick={() => setShowTerms(true)} style={{ width: '100%', padding: '12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
            📄 View Terms & Conditions
          </button>
        </div>

        {formError && (
          <div style={{ padding: 14, background: '#fef2f2', borderRadius: 12, color: '#dc2626', fontSize: '0.9rem', fontWeight: 600, marginBottom: 16 }}>
            {formError}
          </div>
        )}

        <button type="submit" disabled={saving} style={{ width: '100%', padding: '16px', background: saving ? '#94a3b8' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: 'white', border: 'none', borderRadius: 14, fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 4px 16px rgba(34,197,94,0.3)' }}>
          {saving ? 'Submitting...' : 'Next Step →'}
        </button>
      </form>

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
              <button onClick={() => { setAgreedToTerms(true); setShowTerms(false) }} style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', border: 'none', borderRadius: 12, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}>
                ✅ I Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}