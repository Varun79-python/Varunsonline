'use client'
import { useEffect, useState, useRef } from 'react'
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
  const [uploading, setUploading] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    password: '',
    shop_name: '',
    shop_photo_url: '',
    adhaar_front_url: '',
    adhaar_back_url: '',
    terms_accepted: false,
  })

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

  async function getUserId(): Promise<string | null> {
    let { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      if (!form.email.trim() || !form.password.trim() || !form.full_name.trim() || !form.shop_name.trim()) {
        alert('Please fill all required fields first')
        return null
      }
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name.trim(), role: 'shopkeeper' } }
      })
      if (signUpError) { alert('Account creation failed: ' + signUpError.message); return null }
      if (!signUpData.user) { alert('Failed to create account'); return null }
      user = signUpData.user
    }
    return user?.id || null
  }

  async function uploadShopPhoto(file: File) {
    setUploading(true)
    try {
      const userId = await getUserId()
      if (!userId) { setUploading(false); return null }
      
      const ext = file.name.split('.').pop()
      const fileName = `${userId}/shop_${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('shop-images').upload(fileName, file)
      if (error) { alert('Upload failed: ' + error.message); setUploading(false); return null }
      const { data: { publicUrl } } = supabase.storage.from('shop-images').getPublicUrl(fileName)
      setUploading(false)
      return publicUrl
    } catch (err: any) { alert('Upload failed: ' + err.message); setUploading(false); return null }
  }

  async function uploadAdhaarDoc(file: File, frontOrBack: 'front' | 'back') {
    setUploadingDoc(true)
    try {
      const userId = await getUserId()
      if (!userId) { setUploadingDoc(false); return null }
      
      const ext = file.name.split('.').pop()
      const docType = frontOrBack === 'front' ? 'aadhar_front' : 'aadhar_back'
      const fileName = `${userId}/${docType}_${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('shop-documents').upload(fileName, file)
      if (error) { alert('Upload failed: ' + error.message); setUploadingDoc(false); return null }
      const { data: { publicUrl } } = supabase.storage.from('shop-documents').getPublicUrl(fileName)
      setUploadingDoc(false)
      return publicUrl
    } catch (err: any) { alert('Upload failed: ' + err.message); setUploadingDoc(false); return null }
  }

  function handleShopPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) { alert('File too large. Maximum size is 5MB'); return }
    uploadShopPhoto(file).then(url => { if (url) setForm(f => ({ ...f, shop_photo_url: url })) })
  }

  function handleAdhaarSelect(e: React.ChangeEvent<HTMLInputElement>, frontOrBack: 'front' | 'back') {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) { alert('File too large. Maximum size is 5MB'); return }
    uploadAdhaarDoc(file, frontOrBack).then(url => { 
      if (url) {
        if (frontOrBack === 'front') setForm(f => ({ ...f, adhaar_front_url: url }))
        else setForm(f => ({ ...f, adhaar_back_url: url }))
      }
    })
  }

  function openCamera(type: 'shop' | 'adhaar_front' | 'adhaar_back') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > MAX_FILE_SIZE) { alert('File too large. Maximum size is 5MB'); return }
      
      if (type === 'shop') {
        uploadShopPhoto(file).then(url => { if (url) setForm(f => ({ ...f, shop_photo_url: url })) })
      } else if (type === 'adhaar_front') {
        uploadAdhaarDoc(file, 'front').then(url => { if (url) setForm(f => ({ ...f, adhaar_front_url: url })) })
      } else if (type === 'adhaar_back') {
        uploadAdhaarDoc(file, 'back').then(url => { if (url) setForm(f => ({ ...f, adhaar_back_url: url })) })
      }
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
    if (!form.shop_photo_url) { alert('Please upload Shop Photo'); return }
    if (!form.adhaar_front_url) { alert('Please upload Aadhaar Card (Front)'); return }
    if (!form.adhaar_back_url) { alert('Please upload Aadhaar Card (Back)'); return }
    if (!form.terms_accepted) { alert('Please accept Terms & Conditions'); return }

    setSaving(true)
    let { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name.trim(), role: 'shopkeeper' } }
      })
      if (signUpError) { alert('Registration failed: ' + signUpError.message); setSaving(false); return }
      if (!signUpData.user) { alert('Failed to create account'); setSaving(false); return }
      user = signUpData.user
    }

    const { data: shopData, error: shopError } = await supabase.from('shops').insert({
      owner_id: user.id,
      full_name: form.full_name.trim(),
      phone: form.phone_number.trim(),
      email: form.email.trim(),
      name: form.shop_name.trim(),
      shop_image_url: form.shop_photo_url,
      terms_accepted: true,
      is_approved: false,
      is_active: false,
    }).select().single()

    if (shopError) { alert(shopError.message); setSaving(false); return }

    // Save adhaar documents
    await supabase.from('shop_documents').insert([
      { shop_id: shopData.id, doc_type: 'aadhar_front', file_url: form.adhaar_front_url, file_name: 'Aadhaar Front' },
      { shop_id: shopData.id, doc_type: 'aadhar_back', file_url: form.adhaar_back_url, file_name: 'Aadhaar Back' }
    ])

    setDone(true); setSaving(false)
  }

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', background: 'white', padding: 40, borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>📝</div>
        <h2 style={{ marginBottom: 12, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Registration Submitted!</h2>
        <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
          Your shop account is pending admin approval.<br />You can start your business after approval.
        </p>
        <button onClick={() => router.push('/login/shopkeeper')} style={{ padding: '12px 32px', background: '#f97316', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
          Go to Login
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
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Register your shop to start selling</p>
        </div>

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
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Create a password (min 6 chars)" style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Shop Name *</label>
              <input value={form.shop_name} onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))} placeholder="e.g. Ravi General Store" style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>

            {/* Shop Photo */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Shop Photo * <span style={{ color: '#64748b', fontWeight: 400 }}>(Max 5MB)</span></label>
              {form.shop_photo_url ? (
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                  <img src={form.shop_photo_url} alt="Shop" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                  <button onClick={() => setForm(f => ({ ...f, shop_photo_url: '' }))} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ flex: 1, padding: 20, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                    <input type="file" accept="image/*" onChange={handleShopPhotoSelect} style={{ display: 'none' }} />
                    <div style={{ fontSize: '2rem', marginBottom: 4 }}>📁</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Upload from Gallery</div>
                  </label>
                  <button onClick={() => openCamera('shop')} style={{ flex: 1, padding: 20, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 4 }}>📷</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Take Photo</div>
                  </button>
                </div>
              )}
              {uploading && <div style={{ textAlign: 'center', padding: 10, color: '#f97316' }}>⏳ Uploading...</div>}
            </div>

            {/* Aadhaar Front */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Aadhaar Card (Front) * <span style={{ color: '#64748b', fontWeight: 400 }}>(Max 5MB)</span></label>
              {form.adhaar_front_url ? (
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                  <img src={form.adhaar_front_url} alt="Aadhaar Front" style={{ width: '100%', height: 150, objectFit: 'cover' }} />
                  <button onClick={() => setForm(f => ({ ...f, adhaar_front_url: '' }))} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ flex: 1, padding: 16, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                    <input type="file" accept="image/*" onChange={(e) => handleAdhaarSelect(e, 'front')} style={{ display: 'none' }} />
                    <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📁</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Upload</div>
                  </label>
                  <button onClick={() => openCamera('adhaar_front')} style={{ flex: 1, padding: 16, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📷</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Camera</div>
                  </button>
                </div>
              )}
            </div>

            {/* Aadhaar Back */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Aadhaar Card (Back) * <span style={{ color: '#64748b', fontWeight: 400 }}>(Max 5MB)</span></label>
              {form.adhaar_back_url ? (
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                  <img src={form.adhaar_back_url} alt="Aadhaar Back" style={{ width: '100%', height: 150, objectFit: 'cover' }} />
                  <button onClick={() => setForm(f => ({ ...f, adhaar_back_url: '' }))} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ flex: 1, padding: 16, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                    <input type="file" accept="image/*" onChange={(e) => handleAdhaarSelect(e, 'back')} style={{ display: 'none' }} />
                    <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📁</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Upload</div>
                  </label>
                  <button onClick={() => openCamera('adhaar_back')} style={{ flex: 1, padding: 16, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📷</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Camera</div>
                  </button>
                </div>
              )}
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

            <button onClick={submit} disabled={saving || uploading || uploadingDoc} style={{ padding: 16, background: saving ? '#94a3b8' : '#f97316', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
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