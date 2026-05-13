'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TERMS_TEXT = `### Shopkeeper Terms & Conditions

1. The shopkeeper must provide genuine and accurate information during registration.

2. Selling expired, damaged, duplicate, fake, unsafe, or poor-quality products is strictly prohibited.

3. If customers repeatedly receive damaged, expired, wrong, or low-quality products, strict action will be taken including warnings, temporary suspension, payment hold, or permanent account removal.

4. Fake product listings, misleading prices, false offers, or intentionally incorrect product information are strictly prohibited.

5. Shopkeepers must ensure all products are hygienic, safe, properly packed, and in good condition before handing over to delivery agents.

6. Intentional order cancellations after accepting orders, repeated delays, or bad order handling may reduce shop visibility or result in penalties.

7. The shopkeeper is responsible for maintaining correct stock availability and pricing.

8. Fraudulent activity, fake orders, scams, payment abuse, or misuse of the platform may lead to permanent banning and legal action.

9. Shopkeepers must treat customers, delivery agents, and platform staff professionally.

10. Misconduct, abusive language, harassment, threats, or repeated customer complaints may result in account suspension.

11. The platform has the right to approve, reject, suspend, or permanently terminate any shopkeeper account if suspicious activity or policy violations are detected.

12. Shops must comply with local laws, food safety standards, and applicable business regulations.

13. Repeated poor customer ratings, damaged product complaints, or policy violations may reduce visibility or disable the shop.

14. By registering, the shopkeeper confirms all submitted information is true and agrees to platform verification and admin approval.`

export default function ShopRegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [uploading, setUploading] = useState(false)
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
  const [userId, setUserId] = useState<string | null>(null)
  
  // Refs for debounce
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => { mountedRef.current = true }, [])

  // Check for existing user before signUp - Real-time detection with auto-fill
  // This uses the server-side function for comprehensive checking
  const checkExistingUser = useCallback(async (phone: string, email: string) => {
    if (!phone.trim() && !email.trim()) return
    
    setCheckingExisting(true)
    setExistingUserMessage('')
    
    try {
      // Try server-side function first (most reliable)
      try {
        const { data: statusData, error: statusError } = await supabase.rpc(
          'check_registration_status',
          { p_phone: phone.trim(), p_email: email.trim() }
        )
        
        if (!statusError && statusData && statusData.length > 0) {
          const status = statusData[0]
          if (status.exists) {
            const userId = status.user_id
            localStorage.setItem('shopkeeper_reg_user_id', userId)
            
            // Auto-fill based on registration step
            if (status.registration_step === 'documents_pending') {
              setExistingUserMessage('Existing registration found. Continuing to document upload...')
              setTimeout(() => router.push('/login/shopkeeper/register/documents'), 1000)
              setCheckingExisting(false)
              return
            } else if (status.registration_step === 'verification_pending') {
              setExistingUserMessage('Documents uploaded. Waiting for admin approval.')
              setCheckingExisting(false)
              return
            } else if (status.registration_step === 'approved') {
              setExistingUserMessage('Your shop is already approved! Redirecting to login...')
              setTimeout(() => router.push('/login/shopkeeper'), 1500)
              setCheckingExisting(false)
              return
            }
          }
        }
      } catch (rpcErr) {
        console.log('RPC check failed, using fallback:', rpcErr)
      }
      
      // Fallback: Check by phone in shops table directly
      if (phone.trim()) {
        const { data: shop } = await supabase
          .from('shops')
          .select('id, owner_id, name, is_approved, is_active, full_name, phone, email')
          .eq('phone', phone.trim())
          .maybeSingle()
        
        if (shop) {
          // Auto-fill form with existing data
          setForm(prev => ({
            ...prev,
            full_name: shop.full_name || prev.full_name,
            phone_number: shop.phone || prev.phone_number,
            email: shop.email || prev.email,
            shop_name: shop.name || prev.shop_name,
          }))
          
          // Check if we have an active session
          const { data: { session } } = await supabase.auth.getSession()
          
          if (session?.user && session.user.id === shop.owner_id) {
            // Already logged in, redirect based on status
            localStorage.setItem('shopkeeper_reg_user_id', shop.owner_id)
            const { data: docs } = await supabase
              .from('shop_documents')
              .select('id')
              .eq('shop_id', shop.id)
              .limit(1)
            
            if (shop.is_approved && shop.is_active) {
              setExistingUserMessage('Your shop is already approved!')
              setTimeout(() => router.push('/login/shopkeeper'), 1500)
            } else if (docs && docs.length > 0) {
              setExistingUserMessage('Documents uploaded. Waiting for approval.')
            } else {
              setExistingUserMessage('Existing registration found. Continuing to document upload...')
              setTimeout(() => router.push('/login/shopkeeper/register/documents'), 1000)
            }
            setCheckingExisting(false)
            return
          } else {
            // Not logged in - show message to login
            setExistingUserMessage('This phone number is already registered. Please login to continue.')
            setCheckingExisting(false)
            return
          }
        }
      }
      
      // Check by email in profiles
      if (email.trim()) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('email', email.trim().toLowerCase())
          .maybeSingle()
        
        if (profile && profile.role === 'shopkeeper') {
          setExistingUserMessage('An account with this email already exists. Please login to continue.')
          setCheckingExisting(false)
          return
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

  // Watch for phone/email changes with debounce
  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    
    debounceTimeout.current = setTimeout(() => {
      checkExistingUser(form.phone_number, form.email)
    }, 500)

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    }
  }, [form.phone_number, form.email, checkExistingUser])

  async function uploadPhoto(file: File) {
    // Validate file first
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      alert('Only JPG, JPEG, PNG files are allowed.')
      return null
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum size is 5MB')
      return null
    }
    
    setUploading(true)
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('Please login to upload')
      setUploading(false)
      return null
    }
    
    const ext = file.name.split('.').pop()
    const path = `${user.id}/shop_photo_${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('shop-images').upload(path, file, {
      upsert: true,
      contentType: file.type
    })
    if (error) { 
      console.error('Upload error:', error)
      alert('Upload failed: ' + error.message); 
      setUploading(false); 
      return null 
    }
    const { data: { publicUrl } } = supabase.storage.from('shop-images').getPublicUrl(path)
    setUploading(false)
    return publicUrl
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      alert('Only JPG, JPEG, PNG files are allowed.')
      return
    }
    if (file.size > 5 * 1024 * 1024) { alert('File too large. Maximum size is 5MB'); return }
    uploadPhoto(file).then(url => { if (url) setForm(f => ({ ...f, shop_photo_url: url })) })
  }

  function openCamera() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/jpg,image/png'
    input.capture = 'environment'
    input.onchange = (e: any) => { 
      const file = e.target.files?.[0]
      if (!file) return
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        alert('Only JPG, JPEG, PNG files are allowed.')
        return
      }
      if (file.size > 5 * 1024 * 1024) { alert('File too large. Maximum size is 5MB'); return }
      uploadPhoto(file).then(url => { if (url) setForm(f => ({ ...f, shop_photo_url: url })) }) 
    }
    input.click()
  }

  async function submit() {
    if (!form.full_name.trim()) { alert('Please enter Full Name'); return }
    if (!form.phone_number.trim()) { alert('Please enter Phone Number'); return }
    if (!form.email.trim()) { alert('Please enter Email'); return }
    if (!form.password.trim()) { alert('Please enter Password'); return }
    if (form.password.length < 6) { alert('Password must be at least 6 characters'); return }
    if (!form.shop_name.trim()) { alert('Please enter Shop Name'); return }
    if (!form.terms_accepted) { alert('Please accept Terms & Conditions'); return }

    setSaving(true)
    
    // CRITICAL: Check for existing user BEFORE attempting signUp
    // This prevents the "User already registered" error
    try {
      // First try to sign in - if user exists, this will work
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password
      })
      
      if (signInData?.user) {
        // User already exists and password is correct - check shop
        const { data: shop } = await supabase
          .from('shops')
          .select('id, is_approved')
          .eq('owner_id', signInData.user.id)
          .maybeSingle()
        
        if (shop) {
          // Shop exists - redirect to documents
          localStorage.setItem('shopkeeper_reg_user_id', signInData.user.id)
          router.push('/login/shopkeeper/register/documents')
          setSaving(false)
          return
        } else {
          // User has auth account but no shop - create shop
          const { error: shopError } = await supabase.from('shops').insert({
            owner_id: signInData.user.id,
            full_name: form.full_name.trim(),
            phone: form.phone_number.trim(),
            email: form.email.trim(),
            name: form.shop_name.trim(),
            terms_accepted: true,
            is_approved: false,
            is_active: false,
          })
          
          if (shopError) {
            alert('Error: ' + shopError.message)
            setSaving(false)
            return
          }
          
          localStorage.setItem('shopkeeper_reg_user_id', signInData.user.id)
          setDone(true)
          setSaving(false)
          return
        }
      }
      
      // If sign in failed (wrong password or user doesn't exist), try sign up
      if (signInError && !signInError.message.includes('Invalid login')) {
        // Some other error - might be user already registered with different password
        console.log('SignIn error:', signInError.message)
      }
      
      // Try sign up
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name.trim(), role: 'shopkeeper' } }
      })
      
      // Handle "User already registered" error gracefully
      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered') || 
            signUpError.message.toLowerCase().includes('already exists') ||
            signUpError.message.toLowerCase().includes('user already exists')) {
          
          // Try one more time with sign in
          const { data: retrySignIn } = await supabase.auth.signInWithPassword({
            email: form.email.trim(),
            password: form.password
          })
          
          if (retrySignIn?.user) {
            localStorage.setItem('shopkeeper_reg_user_id', retrySignIn.user.id)
            router.push('/login/shopkeeper/register/documents')
            setSaving(false)
            return
          } else {
            alert('An account with this email already exists. Please use the correct password or reset your password.')
            setSaving(false)
            return
          }
        } else {
          alert('Registration failed: ' + signUpError.message)
          setSaving(false)
          return
        }
      }
      
      if (!signUpData?.user) {
        alert('Failed to create account')
        setSaving(false)
        return
      }

      // Create shop record
      const { error: shopError } = await supabase.from('shops').insert({
        owner_id: signUpData.user.id,
        full_name: form.full_name.trim(),
        phone: form.phone_number.trim(),
        email: form.email.trim(),
        name: form.shop_name.trim(),
        terms_accepted: true,
        is_approved: false,
        is_active: false,
      })

      if (shopError) { 
        alert('Error saving shop: ' + shopError.message)
        setSaving(false)
        return
      }
      
      localStorage.setItem('shopkeeper_reg_user_id', signUpData.user.id)
      setUserId(signUpData.user.id)
      setDone(true)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      if (mountedRef.current) {
        setSaving(false)
      }
    }
  }

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', background: 'white', padding: 40, borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
        <h2 style={{ marginBottom: 12, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Step 1 Complete!</h2>
        <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
          Your basic details have been saved.<br /><br />Now please upload your shop photo and documents to complete registration.
        </p>
        
        <button 
          onClick={() => router.push('/login/shopkeeper/register/documents')} 
          style={{ padding: '14px 28px', background: '#f97316', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: '1rem', marginBottom: 12, boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}
        >
          📄 Add Documents
        </button>
        
        <div style={{ marginTop: 16 }}>
          <button onClick={() => { localStorage.removeItem('shopkeeper_reg_user_id'); router.push('/login/shopkeeper') }} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline' }}>
            Do this later - Go to Login
          </button>
        </div>
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
          <button onClick={() => router.push('/login/shopkeeper')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', marginBottom: 8 }}>←</button>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏪</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Shopkeeper Registration</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Register your shop to start selling</p>
        </div>

        {/* Existing User Detection Message */}
        {(checkingExisting || existingUserMessage) && (
          <div style={{ 
            padding: 14, 
            borderRadius: 12, 
            marginBottom: 16,
            background: existingUserMessage.includes('Redirecting') || existingUserMessage.includes('approved') ? '#dcfce7' : existingUserMessage.includes('login') ? '#fef3c7' : '#f0f9ff',
            color: existingUserMessage.includes('Redirecting') || existingUserMessage.includes('approved') ? '#16a34a' : existingUserMessage.includes('login') ? '#92400e' : '#0369a1',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            {checkingExisting ? (
              <><span style={{ animation: 'spin 1s linear infinite' }}>⏳</span> Checking existing account...</>
            ) : (
              <>✅ {existingUserMessage}</>
            )}
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Full Name (as per Aadhaar) *</label>
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
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Create a password (min 6 chars)" style={{ width: '100%', padding: '14px 16px', paddingRight: 44, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {showPassword ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
              </div>
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
                  <button type="button" onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: '#f97316', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Shopkeeper Terms & Conditions</button>
                </span>
              </label>
            </div>

            <button onClick={submit} disabled={saving || uploading} style={{ padding: 16, background: saving ? '#94a3b8' : '#f97316', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Submitting...' : '📝 Submit for Approval'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/login/shopkeeper" style={{ color: '#64748b', fontSize: '0.9rem' }}>← Back to Login</a>
        </div>
      </div>
    </div>
  )
}