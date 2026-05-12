'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const VEHICLE_TYPES = ['Bike', 'Scooter', 'Bicycle', 'Car', 'EV Bike', 'Other']

export default function DeliveryRegisterPage() {
  const supabase = createClient()
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    vehicle_type: 'Bike',
    vehicle_number: '',
    aadhar_url: '',
  })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    async function prefill() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login/delivery'); return }
      setForm(f => ({ ...f, email: user.email || '' }))
      const { data: agent } = await supabase.from('delivery_agents').select('*').eq('id', user.id).single()
      if (agent) {
        setAlreadyRegistered(true)
        setForm({
          full_name: agent.full_name || '',
          email: agent.email || user.email || '',
          phone: agent.phone || '',
          vehicle_type: agent.vehicle_type || 'Bike',
          vehicle_number: agent.vehicle_number || '',
          aadhar_url: agent.aadhar_url || '',
        })
        if (agent.is_approved) {
          router.replace('/delivery')
        }
        if (!agent.is_approved && agent.rejection_reason) {
          setDone(true)
        }
      }
      setLoading(false)
    }
    prefill()
  }, [])

  async function handleAadhaarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const ext = file.name.split('.').pop()
    const path = `aadhar/${user?.id}/aadhar-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('agent-documents').upload(path, file, { upsert: true })
    if (error) { alert('Upload failed: ' + error.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('agent-documents').getPublicUrl(path)
    setForm(f => ({ ...f, aadhar_url: publicUrl }))
    setUploading(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!form.full_name.trim()) { setFormError('Full Name is required'); return }
    if (!form.email.trim()) { setFormError('Email is required'); return }
    if (!form.phone.trim()) { setFormError('Phone Number is required'); return }
    if (!form.vehicle_type) { setFormError('Vehicle Type is required'); return }
    if (!form.vehicle_number.trim()) { setFormError('Vehicle Number is required'); return }
    if (!form.aadhar_url) { setFormError('Aadhaar Card photo is required'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { error } = await supabase.from('delivery_agents').upsert({
      id: user.id,
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      vehicle_type: form.vehicle_type,
      vehicle_number: form.vehicle_number.trim().toUpperCase(),
      aadhar_url: form.aadhar_url,
      is_approved: false,
      rejection_reason: null,
      created_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    if (error) { setFormError('Failed to submit: ' + error.message); setSaving(false); return }
    setDone(true)
    setSaving(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (alreadyRegistered && done) return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', background: 'white', borderRadius: 20, padding: 32, maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>📋</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Registration Submitted</h2>
        <p style={{ color: '#64748b', marginBottom: 16 }}>Your registration is pending approval. We'll notify you once reviewed.</p>
        <button onClick={() => router.push('/login/delivery')} style={{ background: '#22c55e', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Back to Login</button>
      </div>
    </div>
  )

  if (alreadyRegistered && !done) return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', background: 'white', borderRadius: 20, padding: 32, maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>⏳</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Registration Under Review</h2>
        <p style={{ color: '#64748b', marginBottom: 16 }}>Your application is being reviewed. You'll be notified once approved.</p>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login/delivery'))} style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '12px 24px', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>Logout</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '0 16px 40px' }}>
      <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/login/delivery')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Delivery Partner Registration</h2>
      </div>

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
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Aadhaar Card *</h3>
          
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="file" accept="image/*" capture="environment" onChange={handleAadhaarUpload} style={{ display: 'none' }} />
            <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: form.aadhar_url ? '#f0fdf4' : '#f8fafc' }}>
              {uploading ? (
                <div style={{ color: '#22c55e', fontWeight: 600 }}>Uploading...</div>
              ) : form.aadhar_url ? (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
                  <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}>Aadhaar Uploaded</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Tap to change</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div>
                  <div style={{ color: '#374151', fontWeight: 600, fontSize: '0.9rem' }}>Upload Aadhaar Photo</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Take photo or choose from gallery</div>
                </div>
              )}
            </div>
          </label>

          {form.aadhar_url && (
            <div style={{ marginTop: 12 }}>
              <img src={form.aadhar_url} alt="Aadhaar" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }} />
            </div>
          )}
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
    </div>
  )
}