'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const VEHICLE_TYPES = ['Bike', 'Scooter', 'Bicycle', 'Car', 'EV Bike']

export default function DeliveryRegisterPage() {
  const supabase = createClient()
  const router = useRouter()
  const mountedRef = useRef(false)
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => { mountedRef.current = true }, [])
  
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    vehicle_type: 'Bike',
    vehicle_number: '',
  })
  const [userId, setUserId] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(false)
  const [existingMessage, setExistingMessage] = useState('')

  // Real-time existing user detection with auto-fill
  const checkExistingUser = useCallback(async (phone: string, email: string) => {
    if (!phone.trim() && !email.trim()) return
    
    setCheckingExisting(true)
    setExistingMessage('')
    
    try {
      // Try server-side function first
      try {
        const { data: statusData, error: statusError } = await supabase.rpc(
          'check_registration_status',
          { p_phone: phone.trim(), p_email: email.trim() }
        )
        
        if (!statusError && statusData && statusData.length > 0) {
          const status = statusData[0]
          if (status.exists && status.user_type === 'delivery_agent') {
            const userId = status.user_id
            localStorage.setItem('delivery_reg_user_id', userId)
            
            // Auto-fill based on registration step
            if (status.registration_step === 'documents_pending') {
              setExistingMessage('Existing registration found. Continuing to document upload...')
              setTimeout(() => router.push('/login/delivery/register/documents'), 1000)
              setCheckingExisting(false)
              return
            } else if (status.registration_step === 'verification_pending') {
              setExistingMessage('Documents uploaded. Waiting for admin approval.')
              setCheckingExisting(false)
              return
            } else if (status.registration_step === 'approved') {
              setExistingMessage('Your account is already approved! Redirecting to login...')
              setTimeout(() => router.push('/login/delivery'), 1500)
              setCheckingExisting(false)
              return
            }
          }
        }
      } catch (rpcErr) {
        console.log('RPC check failed, using fallback')
      }
      
      // Fallback: Check directly in delivery_agents via profile
      const searchValue = phone.trim() || email.trim()
      const isPhone = /^\d{10,}$/.test(searchValue)
      
      // Query via profiles to get delivery agent info
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq(isPhone ? 'phone' : 'email', searchValue)
        .eq('role', 'delivery_agent')
        .maybeSingle()
      
      if (!mountedRef.current) return
      
      if (profile) {
        // Get agent details
        const { data: agent } = await supabase
          .from('delivery_agents')
          .select('id, vehicle_type, vehicle_number, is_approved, aadhar_url, license_url')
          .eq('id', profile.id)
          .maybeSingle()
        
        if (agent) {
          // Auto-fill form with existing data
          setForm(prev => ({
            ...prev,
            full_name: profile.full_name || prev.full_name,
            email: profile.email || prev.email,
            phone: profile.phone || prev.phone,
            vehicle_type: agent.vehicle_type || prev.vehicle_type,
            vehicle_number: agent.vehicle_number || prev.vehicle_number,
          }))
          
          const step2Completed = !!agent.aadhar_url && !!agent.license_url
          
          if (agent.is_approved) {
            setExistingMessage('Your account is already approved! Redirecting to login...')
            setTimeout(() => router.push('/login/delivery'), 1500)
          } else if (step2Completed) {
            setExistingMessage('Documents uploaded. Waiting for approval.')
          } else {
            setExistingMessage('Existing registration found. Continuing to document upload...')
            localStorage.setItem('delivery_reg_user_id', profile.id)
            setTimeout(() => router.push('/login/delivery/register/documents'), 1000)
          }
        }
      }
    } catch (err) {
      console.error('Error checking existing user:', err)
    } finally {
      if (mountedRef.current) {
        setCheckingExisting(false)
      }
    }
  }, [supabase, router])

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

2. Uploading fake Aadhaar details, fake vehicle details, or false identity information may lead to permanent account suspension.

3. The delivery agent is fully responsible for the safety and timely delivery of customer orders.

4. Any theft, fraud, intentional order cancellation, fake delivery completion, or misuse of platform funds may result in permanent banning and legal action.

5. Delivery agents must behave professionally with customers, shopkeepers, and platform staff.

6. Misconduct, abusive behavior, threats, harassment, intoxicated driving, or unsafe behavior may result in immediate account suspension.

7. Cash collected from Cash on Delivery (COD) orders must be settled correctly to the platform without delay.

8. Repeated late deliveries, fake location activity, or intentional order delays may reduce delivery priority or lead to suspension.

9. The platform has the right to approve, reject, suspend, or terminate a delivery agent account at any time if suspicious activity is detected.

10. Vehicle documents, Aadhaar information, and identity details must belong to the registered delivery agent.

11. The delivery agent is responsible for obeying traffic rules, local laws, and maintaining valid vehicle documents.

12. The platform is not responsible for accidents, penalties, traffic violations, or personal losses during delivery.

13. The delivery agent agrees that violating platform policies may result in account blocking, payment hold, or permanent removal.

14. By registering, the delivery agent confirms all submitted details are true and agrees to platform verification and approval.`

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    // Check if existing user is partially registered - redirect to step 2
    const searchValue = form.phone.trim() || form.email.trim()
    if (searchValue) {
      const isPhone = /^\d{10,}$/.test(searchValue)
      const { data: existingAgent } = await supabase
        .from('delivery_agents')
        .select('id, aadhaar_image_url, license_image_url')
        .eq(isPhone ? 'phone' : 'email', searchValue)
        .maybeSingle()
      
      if (existingAgent) {
        const step2Completed = !!existingAgent.aadhaar_image_url && !!existingAgent.license_image_url
        if (!step2Completed) {
          localStorage.setItem('delivery_reg_user_id', existingAgent.id)
          router.push('/login/delivery/register/documents')
          return
        }
      }
    }

    if (!form.full_name.trim()) { setFormError('Full Name is required'); return }
    if (!form.email.trim()) { setFormError('Email is required'); return }
    if (!form.password.trim()) { setFormError('Password is required'); return }
    if (form.password.length < 6) { setFormError('Password must be at least 6 characters'); return }
    if (!form.phone.trim()) { setFormError('Phone Number is required'); return }
    if (!form.vehicle_type) { setFormError('Vehicle Type is required'); return }
    if (form.vehicle_type !== 'Bicycle' && !form.vehicle_number.trim()) { setFormError('Vehicle Number is required'); return }
    if (!agreedToTerms) { setFormError('You must agree to the Terms & Conditions'); return }

    setSaving(true)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.full_name.trim(), role: 'delivery_agent' } }
    })
    
    // Check if user already exists - redirect to step 2
    if (signUpError && (signUpError.message.includes('already registered') || signUpError.message.includes('already exists') || signUpError.message.includes('User already exists'))) {
      const { data: existingUser } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password
      })
      if (existingUser?.user) {
        const { data: agent } = await supabase.from('delivery_agents').select('id').eq('id', existingUser.user.id).single()
        if (agent) {
          localStorage.setItem('delivery_reg_user_id', existingUser.user.id)
          router.push('/login/delivery/register/documents')
          return
        }
      }
      setFormError('Account exists but profile not found. Please contact support.')
      setSaving(false)
      return
    }
    
    if (signUpError) { setFormError(signUpError.message); setSaving(false); return }
    if (!signUpData.user) { setFormError('Failed to create account'); setSaving(false); return }

    const { error } = await supabase.from('delivery_agents').insert({
      id: signUpData.user.id,
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      vehicle_type: form.vehicle_type,
      vehicle_number: form.vehicle_type === 'Bicycle' ? '' : form.vehicle_number.trim().toUpperCase(),
      is_approved: false,
      rejection_reason: null,
      terms_agreed: true,
      created_at: new Date().toISOString(),
    })

    if (error) { setFormError('Failed to submit: ' + error.message); setSaving(false); return }
    
    // Store user ID for next step (document upload)
    localStorage.setItem('delivery_reg_user_id', signUpData.user.id)
    setUserId(signUpData.user.id)
    setDone(true)
    setSaving(false)
  }

  if (done) return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', background: 'white', borderRadius: 20, padding: 32, maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Step 1 Complete!</h2>
        <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>Your basic details have been saved.<br/><br/>Now please upload your documents to complete registration.</p>
        
        <button 
          onClick={() => router.push('/login/delivery/register/documents')} 
          style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: 'white', border: 'none', padding: '14px 28px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: '1rem', marginBottom: 12, boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}
        >
          📄 Add Documents
        </button>
        
        <div style={{ marginTop: 16 }}>
          <button onClick={() => router.push('/login/delivery')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline' }}>
            Do this later - Go to Login
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '0 16px 40px' }}>
      <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/login/delivery')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Delivery Partner Registration</h2>
      </div>

      {(checkingExisting || existingMessage) && (
        <div style={{ 
          maxWidth: 500, 
          margin: '0 auto 16px',
          padding: 14, 
          borderRadius: 12, 
          background: existingMessage.includes('Redirecting') || existingMessage.includes('approved') ? '#dcfce7' : '#f0f9ff',
          color: existingMessage.includes('Redirecting') || existingMessage.includes('approved') ? '#16a34a' : '#0369a1',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          {checkingExisting ? (
            <><span>⏳</span> Checking for existing account...</>
          ) : (
            <>✅ {existingMessage}</>
          )}
        </div>
      )}

      <form onSubmit={submit} style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Personal Details</h3>
          
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Full Name (as per Aadhaar) *</label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Enter your full name" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email ID *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="your@email.com" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password *</label>
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Create a password" style={{ width: '100%', padding: '12px 14px', paddingRight: 44, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {showPassword ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>
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
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Vehicle Number {form.vehicle_type === 'Bicycle' ? '(Optional for Bicycle)' : '*'}</label>
            {form.vehicle_type === 'Bicycle' ? (
              <input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="Not required for Bicycle" disabled style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box', textTransform: 'uppercase', background: '#f1f5f9', color: '#94a3b8' }} />
            ) : (
              <input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="e.g. TS 01 AB 1234" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box', textTransform: 'uppercase' }} />
            )}
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
          {saving ? 'Submitting...' : 'Submit Registration'}
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