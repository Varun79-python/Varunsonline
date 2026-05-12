'use client'
import { useState } from 'react'
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
  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    password: '',
    shop_name: '',
    shop_photo_url: '',
    terms_accepted: false,
  })

  async function uploadPhoto(file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const tempId = 'temp-' + Date.now()
    const path = `shop_photos/${tempId}-${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('uploads').upload(path, file)
    if (error) { alert('Upload failed: ' + error.message); setUploading(false); return null }
    const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
    setUploading(false)
    return publicUrl
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('File too large. Max 5MB'); return }
    uploadPhoto(file).then(url => { if (url) setForm(f => ({ ...f, shop_photo_url: url })) })
  }

  function openCamera() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = (e: any) => { const file = e.target.files?.[0]; if (file) uploadPhoto(file).then(url => { if (url) setForm(f => ({ ...f, shop_photo_url: url })) }) }
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
    if (!form.terms_accepted) { alert('Please accept Terms & Conditions'); return }

    setSaving(true)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.full_name.trim(), role: 'shopkeeper' } }
    })
    if (signUpError) { alert('Registration failed: ' + signUpError.message); setSaving(false); return }
    if (!signUpData.user) { alert('Failed to create account'); setSaving(false); return }

    const { error } = await supabase.from('shops').insert({
      owner_id: signUpData.user.id,
      full_name: form.full_name.trim(),
      phone: form.phone_number.trim(),
      email: form.email.trim(),
      name: form.shop_name.trim(),
      shop_image_url: form.shop_photo_url,
      terms_accepted: true,
      is_approved: false,
      is_active: false,
    })

    if (error) { alert(error.message); setSaving(false); return }
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
          <button onClick={() => router.push('/login/shopkeeper')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', marginBottom: 8 }}>←</button>
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
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Create a password (min 6 chars)" style={{ width: '100%', padding: '14px 16px', paddingRight: 44, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: 0 }}>{showPassword ? '🙈' : '👁️'}</button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Shop Name *</label>
              <input value={form.shop_name} onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))} placeholder="e.g. Ravi General Store" style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Shop Photo *</label>
              {form.shop_photo_url ? (
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                  <img src={form.shop_photo_url} alt="Shop" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                  <button onClick={() => setForm(f => ({ ...f, shop_photo_url: '' }))} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ flex: 1, padding: 20, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                    <input type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                    <div style={{ fontSize: '2rem', marginBottom: 4 }}>📁</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Upload from Gallery</div>
                  </label>
                  <button onClick={openCamera} style={{ flex: 1, padding: 20, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 4 }}>📷</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Take Photo</div>
                  </button>
                </div>
              )}
              {uploading && <div style={{ textAlign: 'center', padding: 10, color: '#f97316' }}>⏳ Uploading...</div>}
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