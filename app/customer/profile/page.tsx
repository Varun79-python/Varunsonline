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

export default function CustomerProfile() {
  const supabase = createClient()
  const [profile, setProfile] = useState({ full_name: '', phone: '', email: '', gender: '' })
  const [addresses, setAddresses] = useState<Record<string, unknown>[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
    await supabase.from('addresses').delete().eq('id', id)
    setAddresses(prev => prev.filter(a => a.id !== id))
  }

  const genderLabel = GENDER_OPTIONS.find(o => o.value === profile.gender)?.label || '—'

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
        {addresses.length === 0 && <p style={{ textAlign: 'center', padding: '20px 0' }}>No saved addresses yet. Add one during checkout.</p>}
        {addresses.map(a => (
          <div key={a.id as string} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{a.house_name as string}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{a.street_name as string}{a.landmark ? `, near ${a.landmark}` : ''}, {a.city as string}</div>
              {(a.phone as string) && <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: 4 }}>📞 {a.phone as string}</div>}
              {a.latitude ? <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>📍 {(a.latitude as number).toFixed(5)}, {(a.longitude as number).toFixed(5)}</div> : null}
            </div>
            <button onClick={() => deleteAddress(a.id as string)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.1rem' }}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  )
}
