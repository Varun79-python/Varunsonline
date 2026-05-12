'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SHOP_CATEGORIES = ['Grocery', 'Pharmacy', 'Bakery', 'Restaurant', 'Electronics', 'Clothing', 'Stationery', 'Other']

export default function ShopRegisterPage() {
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [gettingGPS, setGettingGPS] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', category: 'Grocery',
    address_line1: '', address_line2: '', landmark: '', city: '', state: '', pincode: '',
    phone: '', email: '', upi_id: '',
    latitude: 0, longitude: 0,
    shop_image_url: '', gender: '',
  })
  const [aadharUrl, setAadharUrl] = useState('')

  function getGPS() {
    setGettingGPS(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords
        setForm(f => ({ ...f, latitude, longitude }))
        setGettingGPS(false)
        if (accuracy > 100) {
          alert(`⚠️ GPS accuracy is poor (±${Math.round(accuracy)}m). Your shop location may be inaccurate. Move outside and try again.`)
        }
      },
      err => {
        setGettingGPS(false)
        alert('GPS failed: ' + (err.code === 1 ? 'Permission denied.' : err.code === 2 ? 'Position unavailable.' : 'Timed out.'))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    )
  }

  async function submit() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: shop, error } = await supabase.from('shops').insert({ ...form, owner_id: user.id }).select().single()
    if (error) { alert(error.message); setSaving(false); return }
    // Save gender to profiles
    await supabase.from('profiles').update({ gender: form.gender }).eq('id', user.id)
    if (aadharUrl && shop) {
      await supabase.from('shop_documents').insert({ shop_id: shop.id, doc_type: 'aadhar_front', file_url: aadharUrl, file_name: 'Aadhaar' })
    }
    setDone(true); setSaving(false)
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
      <h2 style={{ marginBottom: 8 }}>Registration Submitted!</h2>
      <p style={{ marginBottom: 24 }}>Your shop is under review. Admin will approve it shortly. You&apos;ll be notified.</p>
      <a href="/shopkeeper" className="btn btn-primary">Back to Dashboard</a>
    </div>
  )

  return (
    <div className="fade-in" style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>🏪 Register Your Shop</h2>
      <p style={{ marginBottom: 28 }}>Fill in your shop details and upload documents for admin approval.</p>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 99, background: step >= s ? 'var(--primary)' : 'var(--bg3)', transition: 'background 0.3s' }} />
        ))}
      </div>

      {step === 1 && (
        <div className="card">
          <h3 style={{ marginBottom: 20 }}>Step 1: Shop Info</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group"><label className="input-label">Shop Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ravi General Store" /></div>
            <div className="input-group"><label className="input-label">Category *</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {SHOP_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="input-group"><label className="input-label">Description</label><textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What do you sell?" /></div>
            <div className="input-group"><label className="input-label">Phone Number *</label><input className="input" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Shop Image URL (optional)</label><input className="input" value={form.shop_image_url} onChange={e => setForm(f => ({ ...f, shop_image_url: e.target.value }))} placeholder="https://..." /></div>
            <div className="input-group">
              <label className="input-label">Gender <span style={{ color: '#ef4444' }}>*</span></label>
              <select className="input" required value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} style={{ width: '100%' }}>
                <option value="" disabled>Select Gender</option>
                <option value="male">👨 Male</option>
                <option value="female">👩 Female</option>
                <option value="other">🌈 Other</option>
                <option value="prefer_not_to_say">🤐 Prefer not to say</option>
              </select>
            </div>
            <button className="btn btn-primary" disabled={!form.name || !form.phone || !form.gender} onClick={() => setStep(2)}>Next →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3 style={{ marginBottom: 20 }}>Step 2: Shop Address</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group"><label className="input-label">Address Line 1 *</label><input className="input" value={form.address_line1} onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Address Line 2</label><input className="input" value={form.address_line2} onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Landmark</label><input className="input" value={form.landmark} onChange={e => setForm(f => ({ ...f, landmark: e.target.value }))} /></div>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="input-group"><label className="input-label">City *</label><input className="input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Pincode</label><input className="input" value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} /></div>
            </div>
            <div>
              <button className="btn btn-secondary btn-sm" onClick={getGPS} disabled={gettingGPS}>{gettingGPS ? '📡 Detecting GPS...' : '📍 Capture GPS Location'}</button>
              {form.latitude !== 0 && <p style={{ marginTop: 6, fontSize: '0.82rem', color: 'var(--success)' }}>✅ GPS: {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}</p>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={!form.address_line1 || !form.city} onClick={() => setStep(3)}>Next →</button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3 style={{ marginBottom: 20 }}>Step 3: Documents & Payment</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group"><label className="input-label">Aadhaar Card URL *</label><input className="input" value={aadharUrl} onChange={e => setAadharUrl(e.target.value)} placeholder="Upload to cloud and paste URL" /></div>
            <div className="input-group"><label className="input-label">UPI ID (for payouts)</label><input className="input" value={form.upi_id} onChange={e => setForm(f => ({ ...f, upi_id: e.target.value }))} placeholder="yourname@upi" /></div>
            <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 8, padding: 14, fontSize: '0.85rem' }}>
              <strong>📋 What happens next?</strong><br />
              Admin will review your documents and approve your shop. You&apos;ll receive a notification once approved.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={saving || !aadharUrl}>{saving ? 'Submitting...' : 'Submit for Approval'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
