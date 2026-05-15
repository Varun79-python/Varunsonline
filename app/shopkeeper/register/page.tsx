'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ShopRegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1) // 1 = form, 2 = documents
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    password: '',
    shop_name: '',
  })
  const [shopPhotoUrl, setShopPhotoUrl] = useState('')
  const [aadharUrl, setAadharUrl] = useState('')
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [shopId, setShopId] = useState<string | null>(null)

  const MAX_FILE_SIZE = 5 * 1024 * 1024

  async function submitForm() {
    if (!form.full_name.trim()) { setError('Please enter Full Name'); return }
    if (!form.phone_number.trim()) { setError('Please enter Phone Number'); return }
    if (!form.email.trim()) { setError('Please enter Email'); return }
    if (!form.password.trim()) { setError('Please enter Password'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (!form.shop_name.trim()) { setError('Please enter Shop Name'); return }

    setSaving(true)
    setError('')
    
    try {
      // Sign up user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name.trim(), role: 'shopkeeper' } }
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

      const uid = signUpData.user.id
      setUserId(uid)

      // Create profile
      await supabase.from('profiles').upsert({
        id: uid,
        full_name: form.full_name.trim(),
        phone: form.phone_number.trim(),
        role: 'shopkeeper',
      })

      // Create shop
      const { data: shopData } = await supabase.from('shops').insert({
        owner_id: uid,
        full_name: form.full_name.trim(),
        phone: form.phone_number.trim(),
        email: form.email.trim(),
        name: form.shop_name.trim(),
        terms_accepted: true,
        is_approved: false,
        is_active: false,
      }).select().single()

      if (shopData) {
        setShopId(shopData.id)
      }

      // Sign in
      await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      })

      // Go to step 2 (documents)
      setStep(2)
    } catch (err: any) {
      setError('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadFile(file: File, docType: string): Promise<string | null> {
    if (!userId) return null
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${userId}/${docType}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('shop-documents').upload(path, file)
      if (uploadError) {
        setError('Upload failed: ' + uploadError.message)
        setUploading(false)
        return null
      }
      const { data: { publicUrl } } = supabase.storage.from('shop-documents').getPublicUrl(path)
      setUploading(false)
      return publicUrl
    } catch (err: any) {
      setError('Upload failed: ' + err.message)
      setUploading(false)
      return null
    }
  }

  function handleShopPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) { setError('File too large. Maximum size is 5MB'); return }
    uploadFile(file, 'shop_photo').then(url => { if (url) setShopPhotoUrl(url) })
  }

  function handleAadharSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) { setError('File too large. Maximum size is 5MB'); return }
    uploadFile(file, 'aadhar').then(url => { if (url) setAadharUrl(url) })
  }

  async function submitDocuments() {
    if (!shopPhotoUrl) { setError('Please upload Shop Photo'); return }
    if (!aadharUrl) { setError('Please upload Aadhaar Card'); return }
    if (!shopId) { setError('Session expired. Please register again.'); return }

    setSaving(true)
    setError('')

    // Save documents
    await supabase.from('shop_documents').insert([
      { shop_id: shopId, doc_type: 'shop_photo', file_url: shopPhotoUrl, file_name: 'Shop Photo' },
      { shop_id: shopId, doc_type: 'aadhar', file_url: aadharUrl, file_name: 'Aadhaar Card' },
    ])

    setSaving(false)
    alert('🎉 Registration Complete!\n\nYour documents have been submitted. Admin will verify and approve your account.')
    router.push('/login/status')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        
        {/* Step Indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: 14, background: step >= 1 ? '#f97316' : '#e2e8f0', color: 'white', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
            <span style={{ fontSize: '0.85rem', color: step >= 1 ? '#0f172a' : '#94a3b8', fontWeight: 600 }}>Details</span>
          </div>
          <div style={{ width: 40, height: 2, background: '#e2e8f0', marginTop: 14 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: 14, background: step >= 2 ? '#f97316' : '#e2e8f0', color: 'white', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
            <span style={{ fontSize: '0.85rem', color: step >= 2 ? '#0f172a' : '#94a3b8', fontWeight: 600 }}>Documents</span>
          </div>
        </div>

        {error && (
          <div style={{ padding: 14, background: '#fef2f2', borderRadius: 12, color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Step 1: Registration Form */}
        {step === 1 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏪</div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Shopkeeper Registration</h1>
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Register your shop to start selling</p>
            </div>

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

                <button onClick={submitForm} disabled={saving} style={{ padding: 16, background: saving ? '#94a3b8' : '#f97316', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Processing...' : 'Next: Upload Documents →'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Documents Upload */}
        {step === 2 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📄</div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Upload Documents</h1>
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Complete your registration</p>
            </div>

            <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Shop Photo * <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Max 5MB)</span></h3>
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input type="file" accept="image/*" onChange={handleShopPhotoSelect} style={{ display: 'none' }} />
                <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: shopPhotoUrl ? '#f0fdf4' : '#f8fafc' }}>
                  {uploading ? (
                    <div><div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div><div style={{ color: '#f97316', fontWeight: 600 }}>Uploading...</div></div>
                  ) : shopPhotoUrl ? (
                    <div><div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div><div style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}>Uploaded</div></div>
                  ) : (
                    <div><div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div><div style={{ color: '#374151', fontWeight: 600, fontSize: '0.9rem' }}>Upload Shop Photo</div></div>
                  )}
                </div>
              </label>
              {shopPhotoUrl && <img src={shopPhotoUrl} alt="Shop" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, marginTop: 12 }} />}
            </div>

            <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Aadhaar Card * <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Max 5MB)</span></h3>
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input type="file" accept="image/*" onChange={handleAadharSelect} style={{ display: 'none' }} />
                <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: aadharUrl ? '#f0fdf4' : '#f8fafc' }}>
                  {uploading ? (
                    <div><div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div><div style={{ color: '#f97316', fontWeight: 600 }}>Uploading...</div></div>
                  ) : aadharUrl ? (
                    <div><div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div><div style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}>Uploaded</div></div>
                  ) : (
                    <div><div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div><div style={{ color: '#374151', fontWeight: 600, fontSize: '0.9rem' }}>Upload Aadhaar Photo</div></div>
                  )}
                </div>
              </label>
              {aadharUrl && <img src={aadharUrl} alt="Aadhaar" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, marginTop: 12 }} />}
            </div>

            <button onClick={submitDocuments} disabled={saving || uploading || !shopPhotoUrl || !aadharUrl} style={{ width: '100%', padding: 16, background: saving ? '#94a3b8' : '#f97316', color: 'white', border: 'none', borderRadius: 14, fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Submitting...' : 'Complete Registration'}
            </button>

            <button onClick={() => setStep(1)} style={{ width: '100%', marginTop: 12, padding: 12, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>
              ← Back to Details
            </button>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/login/shopkeeper" style={{ color: '#64748b', fontSize: '0.9rem' }}>← Back to Login</a>
        </div>
      </div>
    </div>
  )
}