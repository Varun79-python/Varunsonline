'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DeliveryRegisterPage() {
  const supabase = createClient()
  const [form, setForm] = useState({ aadhar_url: '', license_url: '', live_photo_url: '', vehicle_type: 'Bike', vehicle_number: '', upi_id: '' })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('delivery_agents').upsert({ id: user.id, ...form })
    setDone(true); setSaving(false)
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
      <h2 style={{ marginBottom: 8 }}>Application Submitted!</h2>
      <p>Admin will verify your documents and approve your account soon.</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }} className="fade-in">
      <h2 style={{ marginBottom: 8 }}>🛵 Become a Delivery Partner</h2>
      <p style={{ marginBottom: 28 }}>Upload your documents below. Admin will approve within 24 hours.</p>
      <form className="card" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="input-group"><label className="input-label">Aadhaar Card URL *</label><input className="input" required value={form.aadhar_url} onChange={e => setForm(f => ({ ...f, aadhar_url: e.target.value }))} placeholder="Upload and paste URL" /></div>
        <div className="input-group"><label className="input-label">Driving License URL *</label><input className="input" required value={form.license_url} onChange={e => setForm(f => ({ ...f, license_url: e.target.value }))} placeholder="Upload and paste URL" /></div>
        <div className="input-group"><label className="input-label">Live Photo URL *</label><input className="input" required value={form.live_photo_url} onChange={e => setForm(f => ({ ...f, live_photo_url: e.target.value }))} placeholder="Your selfie URL" /></div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="input-group"><label className="input-label">Vehicle Type</label>
            <select className="input" value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
              {['Bike', 'Scooter', 'Bicycle', 'Auto'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="input-group"><label className="input-label">Vehicle Number</label><input className="input" value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} /></div>
        </div>
        <div className="input-group"><label className="input-label">UPI ID (for payouts)</label><input className="input" value={form.upi_id} onChange={e => setForm(f => ({ ...f, upi_id: e.target.value }))} placeholder="yourname@upi" /></div>
        <button className="btn btn-primary btn-full" type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit Application'}</button>
      </form>
    </div>
  )
}
