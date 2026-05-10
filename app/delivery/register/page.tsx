'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeliveryRegisterPage() {
  const supabase = createClient()
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', gender: '',
    license_number: '', aadhar_url: '', license_url: '', live_photo_url: '',
    vehicle_type: 'Bike', vehicle_number: '', upi_id: ''
  })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function prefill() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      // Pre-fill email from auth
      setForm(f => ({ ...f, email: user.email || '', full_name: user.user_metadata?.full_name || '' }))

      // Check if already registered
      const { data: agent } = await supabase.from('delivery_agents').select('*').eq('id', user.id).single()
      if (agent) {
        setAlreadyRegistered(true)
        setForm({
          full_name: agent.full_name || user.user_metadata?.full_name || '',
          phone: agent.phone || '',
          email: agent.email || user.email || '',
          gender: agent.gender || '',
          license_number: agent.license_number || '',
          aadhar_url: agent.aadhar_url || '',
          license_url: agent.license_url || '',
          live_photo_url: agent.live_photo_url || '',
          vehicle_type: agent.vehicle_type || 'Bike',
          vehicle_number: agent.vehicle_number || '',
          upi_id: agent.upi_id || ''
        })
      }
      setLoading(false)
    }
    prefill()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('delivery_agents').upsert({
      id: user.id,
      ...form,
    })

    // Also update the profiles table name/phone/gender
    await supabase.from('profiles').update({
      full_name: form.full_name,
      phone: form.phone,
      gender: form.gender
    }).eq('id', user.id)

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
      <p style={{ marginBottom: 24 }}>
        {alreadyRegistered
          ? 'Your profile has been updated successfully.'
          : 'Admin will verify your documents and approve your account soon.'}
      </p>
      <a href="/delivery" className="btn btn-primary">Go to Dashboard →</a>
    </div>
  )

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }} className="fade-in">
      <h2 style={{ marginBottom: 4 }}>🛵 {alreadyRegistered ? 'Update Your Profile' : 'Become a Delivery Partner'}</h2>
      <p style={{ marginBottom: 28 }}>
        {alreadyRegistered ? 'Update your details below.' : 'Fill in your details. Admin will approve within 24 hours.'}
      </p>

      <form className="card" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h4 style={{ color: 'var(--primary)', marginBottom: 4 }}>Personal Information</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label className="input-label">Full Name *</label>
            <input className="input" required value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Your full name" />
          </div>
          <div className="input-group">
            <label className="input-label">Phone Number *</label>
            <input className="input" required value={form.phone} type="tel" maxLength={10}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="10-digit mobile number" />
          </div>
        </div>

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

        <div className="input-group">
          <label className="input-label">Email</label>
          <input className="input" value={form.email} disabled style={{ opacity: 0.6 }} />
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />
        <h4 style={{ color: 'var(--primary)', marginBottom: 4 }}>Vehicle Details</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label className="input-label">Vehicle Type *</label>
            <select className="input" required value={form.vehicle_type}
              onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
              {['Bike', 'Scooter', 'Bicycle', 'Auto', 'Car'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Vehicle Number *</label>
            <input className="input" required value={form.vehicle_number}
              onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))}
              placeholder="e.g. TS09AB1234" />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">License Number *</label>
          <input className="input" required value={form.license_number}
            onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))}
            placeholder="DL number e.g. TS0120230001234" />
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />
        <h4 style={{ color: 'var(--primary)', marginBottom: 4 }}>Documents (paste image URLs)</h4>

        <div className="input-group">
          <label className="input-label">Aadhaar Card Photo URL *</label>
          <input className="input" required value={form.aadhar_url}
            onChange={e => setForm(f => ({ ...f, aadhar_url: e.target.value }))}
            placeholder="Upload photo and paste URL" />
        </div>

        <div className="input-group">
          <label className="input-label">Driving License Photo URL *</label>
          <input className="input" required value={form.license_url}
            onChange={e => setForm(f => ({ ...f, license_url: e.target.value }))}
            placeholder="Upload photo and paste URL" />
        </div>

        <div className="input-group">
          <label className="input-label">Live Selfie Photo URL *</label>
          <input className="input" required value={form.live_photo_url}
            onChange={e => setForm(f => ({ ...f, live_photo_url: e.target.value }))}
            placeholder="Upload selfie and paste URL" />
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />
        <h4 style={{ color: 'var(--primary)', marginBottom: 4 }}>Payment Details</h4>

        <div className="input-group">
          <label className="input-label">UPI ID (for payouts)</label>
          <input className="input" value={form.upi_id}
            onChange={e => setForm(f => ({ ...f, upi_id: e.target.value }))}
            placeholder="yourname@upi" />
        </div>

        <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
          {saving ? 'Saving...' : alreadyRegistered ? '💾 Update Details' : '🚀 Submit Application'}
        </button>
      </form>
    </div>
  )
}
