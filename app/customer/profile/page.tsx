'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const GENDER_OPTIONS = [
  { value: '', label: 'Select Gender' },
  { value: 'male', label: '👨 Male' },
  { value: 'female', label: '👩 Female' },
  { value: 'other', label: '🌈 Other' },
  { value: 'prefer_not_to_say', label: '🤐 Prefer not to say' },
]

type Addr = Record<string, unknown>

const blankEdit = { label: '', house_name: '', street_name: '', landmark: '', city: '', pincode: '', phone: '', latitude: 0, longitude: 0 }

export default function CustomerProfile() {
  const supabase = createClient()
  const [profile, setProfile] = useState({ full_name: '', phone: '', email: '', gender: '' })
  const [addresses, setAddresses] = useState<Addr[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ ...blankEdit })
  const [editSaving, setEditSaving] = useState(false)
  const [editGPS, setEditGPS] = useState(false)
  const [editGpsAccuracy, setEditGpsAccuracy] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('full_name, phone, email, gender').eq('id', user.id).single()
      if (p) setProfile({ full_name: p.full_name || '', phone: p.phone || '', email: p.email || '', gender: p.gender || '' })
      const { data: a } = await supabase.from('addresses').select('*').eq('customer_id', user.id)
      setAddresses(a || [])
    }
    load()
  }, [])

  async function saveProfile() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({
      full_name: profile.full_name,
      phone: profile.phone,
      gender: profile.gender
    }).eq('id', user.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function deleteAddress(id: string) {
    if (!confirm('Delete this address?')) return
    await supabase.from('addresses').delete().eq('id', id)
    setAddresses(prev => prev.filter(a => a.id !== id))
  }

  function startEdit(a: Addr) {
    setEditingId(a.id as string)
    setEditForm({
      label: (a.label as string) || 'Home',
      house_name: (a.house_name as string) || '',
      street_name: (a.street_name as string) || '',
      landmark: (a.landmark as string) || '',
      city: (a.city as string) || '',
      pincode: (a.pincode as string) || '',
      phone: (a.phone as string) || '',
      latitude: (a.latitude as number) || 0,
      longitude: (a.longitude as number) || 0,
    })
  }

  function getEditGPS() {
    setEditGPS(true)
    setEditGpsAccuracy(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords
        setEditForm(f => ({ ...f, latitude, longitude }))
        setEditGpsAccuracy(accuracy)
        setEditGPS(false)
        if (accuracy > 100) {
          alert(`⚠️ GPS accuracy is poor (±${Math.round(accuracy)}m). Move to an open area and try again.`)
        }
      },
      err => {
        setEditGPS(false)
        alert('GPS failed: ' + (err.code === 1 ? 'Permission denied.' : err.code === 2 ? 'Position unavailable.' : 'Timed out.'))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    )
  }

  async function saveEdit() {
    if (!editingId) return
    if (!editForm.house_name || !editForm.street_name || !editForm.city) {
      alert('Please fill House Name, Street and City')
      return
    }
    setEditSaving(true)

    // Build payload — only include fields that have values to avoid schema errors
    const updateData: Record<string, unknown> = {
      house_name: editForm.house_name,
      street_name: editForm.street_name,
      city: editForm.city,
    }
    if (editForm.label) updateData.label = editForm.label
    if (editForm.landmark !== undefined) updateData.landmark = editForm.landmark || null
    if (editForm.pincode) updateData.pincode = editForm.pincode
    if (editForm.phone) updateData.phone = editForm.phone
    if (editForm.latitude && editForm.latitude !== 0) updateData.latitude = editForm.latitude
    if (editForm.longitude && editForm.longitude !== 0) updateData.longitude = editForm.longitude

    const { error } = await supabase.from('addresses').update(updateData).eq('id', editingId)
    if (error) {
      alert('Failed to update: ' + error.message)
    } else {
      setAddresses(prev => prev.map(a => a.id === editingId ? { ...a, ...updateData } : a))
      setEditingId(null)
    }
    setEditSaving(false)
  }

  const genderLabel = GENDER_OPTIONS.find(o => o.value === profile.gender)?.label || '—'

  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.88rem', color: '#1e293b', outline: 'none', background: 'white' }

  return (
    <div className="fade-in" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24 }}>👤 My Profile</h2>

      {saved && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, color: 'var(--success)', fontSize: '0.88rem' }}>✅ Profile saved!</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 18 }}>Personal Info</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label">Full Name</label>
            <input className="input" value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label">Phone Number</label>
            <input className="input" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input" value={profile.email} disabled style={{ opacity: 0.6 }} />
          </div>
          <div className="input-group">
            <label className="input-label">Gender</label>
            <select className="input" value={profile.gender} onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))} style={{ width: '100%' }}>
              {GENDER_OPTIONS.map(o => (
                <option key={o.value} value={o.value} disabled={o.value === '' && profile.gender !== ''}>{o.label}</option>
              ))}
            </select>
            {profile.gender && (
              <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Current: {genderLabel}</div>
            )}
          </div>
          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save Profile'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 18 }}>📍 Saved Addresses</h3>
        {addresses.length === 0 && <p style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>No saved addresses yet. Add one during checkout.</p>}
        {addresses.map(a => (
          <div key={a.id as string} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 14 }}>
            {/* Address header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  {a.label ? <span style={{ background: '#fff7ed', color: '#ea580c', padding: '2px 8px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, marginRight: 6 }}>{a.label as string}</span> : null}
                  {a.house_name as string}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 3 }}>{a.street_name as string}{a.landmark ? `, near ${a.landmark}` : ''}, {a.city as string}</div>
                {(a.phone as string) && <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: 4 }}>📞 {a.phone as string}</div>}
                {a.latitude ? <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>📍 GPS saved</div> : null}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => editingId === a.id ? setEditingId(null) : startEdit(a)}
                  style={{ background: editingId === a.id ? '#f1f5f9' : '#fff7ed', border: `1px solid ${editingId === a.id ? '#d1d5db' : '#fed7aa'}`, color: editingId === a.id ? '#64748b' : '#ea580c', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                  {editingId === a.id ? '✕ Cancel' : '✏️ Edit'}
                </button>
                <button onClick={() => deleteAddress(a.id as string)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.1rem', padding: '4px 6px' }}>🗑️</button>
              </div>
            </div>

            {/* Inline edit form */}
            {editingId === a.id && (
              <div style={{ marginTop: 14, padding: 14, background: '#f8fafc', borderRadius: 10, border: '1.5px solid #e2e8f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Label</label>
                    <select style={inputStyle} value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}>
                      {['Home', 'Work', 'Other'].map(l => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>House / Building *</label>
                    <input style={inputStyle} placeholder="e.g. Sunrise Apartments" value={editForm.house_name} onChange={e => setEditForm(f => ({ ...f, house_name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Street / Area *</label>
                    <input style={inputStyle} placeholder="e.g. MG Road" value={editForm.street_name} onChange={e => setEditForm(f => ({ ...f, street_name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>City *</label>
                    <input style={inputStyle} placeholder="City" value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Landmark</label>
                    <input style={inputStyle} placeholder="Near City Mall" value={editForm.landmark} onChange={e => setEditForm(f => ({ ...f, landmark: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Pincode</label>
                    <input style={inputStyle} placeholder="500001" value={editForm.pincode} onChange={e => setEditForm(f => ({ ...f, pincode: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>📞 Phone Number (for delivery agent)</label>
                    <input style={inputStyle} type="tel" placeholder="+91 9XXXXXXXXX" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <button onClick={getEditGPS} disabled={editGPS} style={{ background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 14px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                    {editGPS ? '📡 Detecting...' : '📍 Update GPS Location'}
                  </button>
                  {editForm.latitude !== 0 && editGpsAccuracy !== null && (() => {
                    const acc = Math.round(editGpsAccuracy)
                    const cfg = acc < 20 ? { color: '#16a34a', bg: '#f0fdf4', label: `✅ ±${acc}m` }
                      : acc < 50 ? { color: '#d97706', bg: '#fef3c7', label: `✓ ±${acc}m` }
                      : acc < 100 ? { color: '#ea580c', bg: '#fff7ed', label: `⚠️ ±${acc}m Fair` }
                      : { color: '#dc2626', bg: '#fef2f2', label: `❌ ±${acc}m Poor!` }
                    return <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  })()}
                  {editForm.latitude !== 0 && editGpsAccuracy === null && <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>✅ GPS ready</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEdit} disabled={editSaving} style={{ flex: 1, padding: '10px', background: '#f97316', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                    {editSaving ? 'Saving...' : '💾 Save Changes'}
                  </button>
                  <button onClick={() => setEditingId(null)} style={{ padding: '10px 16px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
