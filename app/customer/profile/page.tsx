'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const GENDER_OPTIONS = [
  { value: '', label: 'Select Gender' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

type Addr = Record<string, unknown>

const blankEdit = { label: '', house_name: '', street_name: '', landmark: '', city: '', pincode: '', phone: '', latitude: 0, longitude: 0 }

const UserIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const PhoneIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
const MailIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
const GenderIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const LocationIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
const LogoutIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
const SaveIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
const EditIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
const HeadsetIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>

export default function CustomerProfile() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState({ full_name: '', phone: '', email: '', gender: '' })
  const [addresses, setAddresses] = useState<Addr[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)

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
      if (p) {
        setProfile({ full_name: p.full_name || '', phone: p.phone || '', email: p.email || '', gender: p.gender || '' })
        setUserName(p.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'User')
      }
      const { data: a } = await supabase.from('addresses').select('*').eq('customer_id', user.id)
      setAddresses(a || [])
    }
    load()
  }, [])

  async function saveProfile() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ full_name: profile.full_name, phone: profile.phone, gender: profile.gender }).eq('id', user.id)
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
    setEditForm({ label: (a.label as string) || 'Home', house_name: (a.house_name as string) || '', street_name: (a.street_name as string) || '', landmark: (a.landmark as string) || '', city: (a.city as string) || '', pincode: (a.pincode as string) || '', phone: (a.phone as string) || '', latitude: (a.latitude as number) || 0, longitude: (a.longitude as number) || 0 })
  }

  function getEditGPS() {
    setEditGPS(true)
    setEditGpsAccuracy(null)
    navigator.geolocation.getCurrentPosition(pos => { setEditForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })); setEditGpsAccuracy(pos.coords.accuracy); setEditGPS(false); if (pos.coords.accuracy > 100) alert(`⚠️ GPS accuracy is poor (±${Math.round(pos.coords.accuracy)}m)`) }, err => { setEditGPS(false); alert('GPS failed') }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 })
  }

  async function saveEdit() {
    if (!editingId) return
    if (!editForm.house_name || !editForm.street_name || !editForm.city) { alert('Please fill House Name, Street and City'); return }
    setEditSaving(true)
    const addressData: Record<string, unknown> = { house_name: editForm.house_name, street_name: editForm.street_name, city: editForm.city }
    if (editForm.label) addressData.label = editForm.label
    if (editForm.landmark !== undefined) addressData.landmark = editForm.landmark || null
    if (editForm.pincode) addressData.pincode = editForm.pincode
    if (editForm.phone) addressData.phone = editForm.phone
    if (editForm.latitude && editForm.latitude !== 0) addressData.latitude = editForm.latitude
    if (editForm.longitude && editForm.longitude !== 0) addressData.longitude = editForm.longitude

    if (editingId === 'new') {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setEditSaving(false); return }
      addressData.customer_id = user.id
      const { data: newAddr, error } = await supabase.from('addresses').insert(addressData).select().single()
      if (error) { alert('Failed to add: ' + error.message) } else if (newAddr) { setAddresses(prev => [...prev, newAddr]) }
      setEditingId(null)
    } else {
      const { error } = await supabase.from('addresses').update(addressData).eq('id', editingId)
      if (error) { alert('Failed to update: ' + error.message) } else { setAddresses(prev => prev.map(a => a.id === editingId ? { ...a, ...addressData } : a)); setEditingId(null) }
    }
    setEditSaving(false)
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  const genderLabel = GENDER_OPTIONS.find(o => o.value === profile.gender)?.label || '—'
  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '0.9rem', color: '#1e293b', outline: 'none', background: '#f8fafc', transition: 'all 0.2s' }

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: '0 16px 120px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ padding: '24px 0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, boxShadow: '0 8px 24px rgba(249,115,22,0.3)' }}>
          <span style={{ fontSize: '2rem', color: 'white' }}>{profile.full_name ? profile.full_name.charAt(0).toUpperCase() : '👤'}</span>
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{userName || 'User'}</h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>{profile.email}</p>
      </div>

      {saved && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 14, marginBottom: 16, color: '#16a34a', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>✅ Profile saved successfully!</div>}

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><span style={{ fontSize: '1.1rem' }}>👤</span><span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>Personal Info</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Full Name</label><div style={{ position: 'relative' }}><span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><UserIcon /></span><input value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} style={{ ...inputStyle, paddingLeft: 40 }} /></div></div>
          <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Phone Number</label><div style={{ position: 'relative' }}><span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><PhoneIcon /></span><input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} style={{ ...inputStyle, paddingLeft: 40 }} /></div></div>
          <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Email</label><div style={{ position: 'relative' }}><span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><MailIcon /></span><input value={profile.email} disabled style={{ ...inputStyle, paddingLeft: 40, opacity: 0.6 }} /></div></div>
          <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Gender</label><div style={{ position: 'relative' }}><span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 1 }}><GenderIcon /></span><select value={profile.gender} onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))} style={{ ...inputStyle, paddingLeft: 40, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>{GENDER_OPTIONS.map(o => <option key={o.value} value={o.value} disabled={o.value === '' && profile.gender !== ''}>{o.label}</option>)}</select></div>{profile.gender && <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#16a34a', fontWeight: 500 }}>✓ Current: {genderLabel}</div>}</div>
          <button onClick={saveProfile} disabled={saving} style={{ background: saving ? '#94a3b8' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: 'white', border: 'none', borderRadius: 12, padding: '14px 20px', fontWeight: 700, fontSize: '0.95rem', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 4px 16px rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><SaveIcon />{saving ? 'Saving...' : 'Save Profile'}</button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><span style={{ fontSize: '1.1rem' }}>📍</span><span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>Saved Addresses</span><button onClick={() => { setEditingId('new'); setEditForm({ ...blankEdit }) }} style={{ marginLeft: 'auto', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', border: 'none', color: 'white', borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>+ Add Address</button></div>
        {addresses.length === 0 && <p style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '0.9rem' }}>No saved addresses yet.</p>}
        {addresses.map(a => (
          <div key={a.id as string} style={{ marginBottom: 16 }}>
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 14, border: editingId === a.id ? '1.5px solid #f97316' : '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div><div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: 6 }}>{a.label ? <span style={{ background: '#fff7ed', color: '#ea580c', padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, marginRight: 8 }}>{a.label as string}</span> : null}{a.house_name as string}</div><div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>{a.street_name as string}{a.landmark ? `, near ${a.landmark}` : ''}, {a.city as string}</div>{(a.phone as string) && <div style={{ fontSize: '0.75rem', color: '#f97316', marginTop: 6, fontWeight: 600 }}>📞 {a.phone as string}</div>}{a.latitude ? <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: 4, fontWeight: 500 }}>✓ GPS location saved</div> : null}</div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}><button onClick={() => editingId === a.id ? setEditingId(null) : startEdit(a)} style={{ background: editingId === a.id ? '#f1f5f9' : '#fff7ed', border: `1px solid ${editingId === a.id ? '#d1d5db' : '#fed7aa'}`, color: editingId === a.id ? '#64748b' : '#ea580c', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><EditIcon />{editingId === a.id ? 'Cancel' : 'Edit'}</button><button onClick={() => deleteAddress(a.id as string)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '6px 8px' }}><TrashIcon /></button></div>
              </div>
              {editingId === a.id && (
                <div style={{ marginTop: 14, padding: 14, background: 'white', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}><div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Label</label><select style={inputStyle} value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}>{['Home', 'Work', 'Other'].map(l => <option key={l}>{l}</option>)}</select></div><div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>House *</label><input style={inputStyle} placeholder="e.g. Sunrise Apartments" value={editForm.house_name} onChange={e => setEditForm(f => ({ ...f, house_name: e.target.value }))} /></div><div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Street *</label><input style={inputStyle} placeholder="e.g. MG Road" value={editForm.street_name} onChange={e => setEditForm(f => ({ ...f, street_name: e.target.value }))} /></div><div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>City *</label><input style={inputStyle} placeholder="City" value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} /></div><div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Landmark</label><input style={inputStyle} placeholder="Near City Mall" value={editForm.landmark} onChange={e => setEditForm(f => ({ ...f, landmark: e.target.value }))} /></div><div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Pincode</label><input style={inputStyle} placeholder="500001" value={editForm.pincode} onChange={e => setEditForm(f => ({ ...f, pincode: e.target.value }))} /></div><div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Phone Number</label><input style={inputStyle} type="tel" placeholder="+91 9XXXXXXXXX" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}><button onClick={getEditGPS} disabled={editGPS} style={{ background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><LocationIcon />{editGPS ? 'Detecting...' : 'Update GPS'}</button>{editForm.latitude !== 0 && editGpsAccuracy !== null && (() => { const acc = Math.round(editGpsAccuracy); const cfg = acc < 20 ? { color: '#16a34a', bg: '#f0fdf4', label: `✓ ±${acc}m` } : acc < 50 ? { color: '#d97706', bg: '#fef3c7', label: `±${acc}m` } : acc < 100 ? { color: '#ea580c', bg: '#fff7ed', label: `⚠ ±${acc}m` } : { color: '#dc2626', bg: '#fef2f2', label: `❌ ±${acc}m` }; return <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 8px', borderRadius: 6, background: cfg.bg, color: cfg.color }}>{cfg.label}</span> })()}</div>
                  <div style={{ display: 'flex', gap: 8 }}><button onClick={saveEdit} disabled={editSaving} style={{ flex: 1, padding: '12px', background: editSaving ? '#94a3b8' : '#f97316', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: editSaving ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>{editSaving ? 'Saving...' : (editingId === 'new' ? 'Add Address' : 'Save Changes')}</button><button onClick={() => setEditingId(null)} style={{ padding: '12px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>Cancel</button></div>
                </div>
              )}
            </div>
          </div>
        ))}
        {editingId === 'new' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 14, border: '1.5px solid #f97316' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: 14 }}>➕ Add New Address</div>
              <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}><div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Label</label><select style={inputStyle} value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}>{['Home', 'Work', 'Other'].map(l => <option key={l}>{l}</option>)}</select></div><div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>House *</label><input style={inputStyle} placeholder="e.g. Sunrise Apartments" value={editForm.house_name} onChange={e => setEditForm(f => ({ ...f, house_name: e.target.value }))} /></div><div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Street *</label><input style={inputStyle} placeholder="e.g. MG Road" value={editForm.street_name} onChange={e => setEditForm(f => ({ ...f, street_name: e.target.value }))} /></div><div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>City *</label><input style={inputStyle} placeholder="City" value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} /></div><div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Landmark</label><input style={inputStyle} placeholder="Near City Mall" value={editForm.landmark} onChange={e => setEditForm(f => ({ ...f, landmark: e.target.value }))} /></div><div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Pincode</label><input style={inputStyle} placeholder="500001" value={editForm.pincode} onChange={e => setEditForm(f => ({ ...f, pincode: e.target.value }))} /></div><div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Phone (for delivery)</label><input style={inputStyle} placeholder="Mobile number" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}><button onClick={getEditGPS} disabled={editGPS} style={{ background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><LocationIcon />{editGPS ? 'Detecting...' : 'Get Current Location'}</button>{editForm.latitude !== 0 && editGpsAccuracy !== null && (() => { const acc = Math.round(editGpsAccuracy); const cfg = acc < 20 ? { color: '#16a34a', bg: '#f0fdf4', label: `✓ ±${acc}m` } : acc < 50 ? { color: '#d97706', bg: '#fef3c7', label: `±${acc}m` } : acc < 100 ? { color: '#ea580c', bg: '#fff7ed', label: `⚠ ±${acc}m` } : { color: '#dc2626', bg: '#fef2f2', label: `❌ ±${acc}m` }; return <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 8px', borderRadius: 6, background: cfg.bg, color: cfg.color }}>{cfg.label}</span> })()}</div>
                <div style={{ display: 'flex', gap: 8 }}><button onClick={saveEdit} disabled={editSaving} style={{ flex: 1, padding: '12px', background: editSaving ? '#94a3b8' : '#f97316', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: editSaving ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>{editSaving ? 'Adding...' : 'Add Address'}</button><button onClick={() => setEditingId(null)} style={{ padding: '12px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>Cancel</button></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <button onClick={() => router.push('/customer/care')} style={{ width: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px', color: '#0f172a', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}><HeadsetIcon />Customer Care & Support</button>
      <button onClick={handleLogout} style={{ width: '100%', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '16px', color: '#dc2626', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><LogoutIcon />Logout</button>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}