'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeliveryRegisterPage() {
  const supabase = createClient()
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', gender: '',
    license_number: '', pan_number: '',
    aadhar_url: '', license_url: '', live_photo_url: '', pan_url: '', vehicle_rc_url: '',
    vehicle_type: 'Bike', vehicle_number: '',
    upi_id: '', bank_account_number: '', bank_ifsc: '', bank_account_name: ''
  })
  const [payMethod, setPayMethod] = useState<'upi' | 'bank'>('upi')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)

  useEffect(() => {
    async function prefill() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setForm(f => ({ ...f, email: user.email || '', full_name: user.user_metadata?.full_name || '' }))
      const { data: agent } = await supabase.from('delivery_agents').select('*').eq('id', user.id).single()
      if (agent) {
        setAlreadyRegistered(true)
        setForm({
          full_name: agent.full_name || user.user_metadata?.full_name || '',
          phone: agent.phone || '', email: agent.email || user.email || '',
          gender: agent.gender || '', license_number: agent.license_number || '',
          pan_number: agent.pan_number || '',
          aadhar_url: agent.aadhar_url || '', license_url: agent.license_url || '',
          live_photo_url: agent.live_photo_url || '', pan_url: agent.pan_url || '',
          vehicle_rc_url: agent.vehicle_rc_url || '',
          vehicle_type: agent.vehicle_type || 'Bike', vehicle_number: agent.vehicle_number || '',
          upi_id: agent.upi_id || '', bank_account_number: agent.bank_account_number || '',
          bank_ifsc: agent.bank_ifsc || '', bank_account_name: agent.bank_account_name || ''
        })
        if (agent.bank_account_number) setPayMethod('bank')
      }
      setLoading(false)
    }
    prefill()
  }, [])

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>, field: string) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(field)
    const { data: { user } } = await supabase.auth.getUser()
    const ext = file.name.split('.').pop()
    const path = `${user?.id}/${field}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('agent-documents').upload(path, file, { upsert: true })
    if (error) { alert('Upload failed: ' + error.message); setUploading(null); return }
    const { data: { publicUrl } } = supabase.storage.from('agent-documents').getPublicUrl(path)
    setForm(f => ({ ...f, [field]: publicUrl }))
    setUploading(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('delivery_agents').upsert({ id: user.id, ...form })
    await supabase.from('profiles').update({ full_name: form.full_name, phone: form.phone }).eq('id', user.id)
    setSaving(false)
    setDone(true)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (done) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
      <h2 style={{ marginBottom: 8 }}>{alreadyRegistered ? 'Details Updated!' : 'Application Submitted!'}</h2>
      <p style={{ marginBottom: 24, color: 'var(--text-muted)' }}>
        {alreadyRegistered ? 'Your profile has been updated successfully.' : 'Admin will verify your documents and approve your account soon. You will be notified.'}
      </p>
      <a href="/delivery" className="btn btn-primary">Go to Dashboard →</a>
    </div>
  )

  const DocUpload = ({ label, field, required = false }: { label: string; field: string; required?: boolean }) => {
    const url = form[field as keyof typeof form] as string
    return (
      <div className="input-group">
        <label className="input-label">{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</label>
        {url ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem' }}>✅ Uploaded — View</a>
            <label style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
              🔄 Re-upload
              <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => uploadFile(e, field)} />
            </label>
          </div>
        ) : (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', border: '2px dashed var(--border)', borderRadius: 8, padding: '12px 16px', background: 'var(--bg)' }}>
            <span style={{ fontSize: '1.4rem' }}>📎</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {uploading === field ? '⏳ Uploading...' : 'Tap to upload (JPG, PNG, PDF)'}
            </span>
            <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => uploadFile(e, field)} disabled={uploading === field} />
          </label>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }} className="fade-in">
      <h2 style={{ marginBottom: 4 }}>🛵 {alreadyRegistered ? 'Update Your Profile' : 'Become a Delivery Partner'}</h2>
      <p style={{ marginBottom: 28, color: 'var(--text-muted)' }}>
        {alreadyRegistered ? 'Update your details below.' : 'Fill in all details & upload required documents. Admin will approve within 24 hours.'}
      </p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* PERSONAL INFO */}
        <div className="card">
          <h4 style={{ color: 'var(--primary)', marginBottom: 16 }}>👤 Personal Information</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="As on Aadhaar" />
              </div>
              <div className="input-group">
                <label className="input-label">Phone <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" required type="tel" maxLength={10} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit" />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Gender <span style={{ color: '#ef4444' }}>*</span></label>
              <select className="input" required value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                <option value="" disabled>Select Gender</option>
                <option value="male">👨 Male</option>
                <option value="female">👩 Female</option>
                <option value="other">🌈 Other</option>
                <option value="prefer_not_to_say">🤐 Prefer not to say</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input className="input" value={form.email} disabled style={{ opacity: 0.6 }} />
            </div>
          </div>
        </div>

        {/* VEHICLE */}
        <div className="card">
          <h4 style={{ color: 'var(--primary)', marginBottom: 16 }}>🏍️ Vehicle Details</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Vehicle Type <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="input" required value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
                  {['Bike', 'Scooter', 'Bicycle', 'Auto', 'Car'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Vehicle Number <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" required value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value.toUpperCase() }))} placeholder="TS09AB1234" />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Driving License Number <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="input" required value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} placeholder="e.g. TS0120230001234" />
            </div>
            <div className="input-group">
              <label className="input-label">PAN Number</label>
              <input className="input" value={form.pan_number} onChange={e => setForm(f => ({ ...f, pan_number: e.target.value.toUpperCase() }))} placeholder="e.g. ABCDE1234F" maxLength={10} />
            </div>
          </div>
        </div>

        {/* DOCUMENTS */}
        <div className="card">
          <h4 style={{ color: 'var(--primary)', marginBottom: 6 }}>📄 Documents</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>Upload clear photos. Admin will verify before approval.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <DocUpload label="Aadhaar Card" field="aadhar_url" required />
            <DocUpload label="Driving License" field="license_url" required />
            <DocUpload label="Live Selfie / Profile Photo" field="live_photo_url" required />
            <DocUpload label="PAN Card" field="pan_url" />
            <DocUpload label="Vehicle RC (Registration Certificate)" field="vehicle_rc_url" />
          </div>
        </div>

        {/* PAYMENT */}
        <div className="card">
          <h4 style={{ color: 'var(--primary)', marginBottom: 16 }}>💳 Payout Details</h4>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button type="button" className={`btn ${payMethod === 'upi' ? 'btn-primary' : ''}`} style={{ flex: 1, background: payMethod === 'upi' ? 'var(--primary)' : 'var(--bg-2)', color: payMethod === 'upi' ? 'white' : 'inherit' }} onClick={() => setPayMethod('upi')}>UPI</button>
            <button type="button" className={`btn ${payMethod === 'bank' ? 'btn-primary' : ''}`} style={{ flex: 1, background: payMethod === 'bank' ? 'var(--primary)' : 'var(--bg-2)', color: payMethod === 'bank' ? 'white' : 'inherit' }} onClick={() => setPayMethod('bank')}>Bank Account</button>
          </div>
          {payMethod === 'upi' ? (
            <div className="input-group">
              <label className="input-label">UPI ID</label>
              <input className="input" value={form.upi_id} onChange={e => setForm(f => ({ ...f, upi_id: e.target.value }))} placeholder="yourname@upi" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Account Holder Name</label>
                <input className="input" value={form.bank_account_name} onChange={e => setForm(f => ({ ...f, bank_account_name: e.target.value }))} placeholder="As per bank records" />
              </div>
              <div className="input-group">
                <label className="input-label">Account Number</label>
                <input className="input" value={form.bank_account_number} onChange={e => setForm(f => ({ ...f, bank_account_number: e.target.value }))} placeholder="Bank account number" />
              </div>
              <div className="input-group">
                <label className="input-label">IFSC Code</label>
                <input className="input" value={form.bank_ifsc} onChange={e => setForm(f => ({ ...f, bank_ifsc: e.target.value.toUpperCase() }))} placeholder="e.g. SBIN0001234" />
              </div>
            </div>
          )}
        </div>

        <button className="btn btn-primary btn-full" type="submit" disabled={saving || !!uploading}>
          {uploading ? '⏳ Uploading document...' : saving ? 'Saving...' : alreadyRegistered ? '💾 Update Details' : '🚀 Submit Application'}
        </button>
      </form>
    </div>
  )
}
