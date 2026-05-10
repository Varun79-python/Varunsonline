'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SHOP_CATEGORIES = ['Grocery', 'Pharmacy', 'Bakery', 'Restaurant', 'Electronics', 'Clothing', 'Stationary', 'Other']

export default function ShopkeeperProfile() {
  const supabase = createClient()
  const [shop, setShop] = useState<Record<string, unknown> | null>(null)
  const [gender, setGender] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [gettingGPS, setGettingGPS] = useState(false)
  const [noShop, setNoShop] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('shops').select('*').eq('owner_id', user.id).single()
      if (!data) { setNoShop(true); return }
      setShop(data)
      const { data: profile } = await supabase.from('profiles').select('gender').eq('id', user.id).single()
      if (profile?.gender) setGender(profile.gender)
    }
    load()
  }, [])

  function update(key: string, value: unknown) { setShop(s => s ? { ...s, [key]: value } : s) }

  async function save() {
    if (!shop) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ gender }).eq('id', user.id)
    await supabase.from('shops').update({ name: shop.name, description: shop.description, category: shop.category, address_line1: shop.address_line1, landmark: shop.landmark, city: shop.city, phone: shop.phone, upi_id: shop.upi_id, bank_account_number: shop.bank_account_number, bank_ifsc: shop.bank_ifsc, is_open: shop.is_open, latitude: shop.latitude, longitude: shop.longitude }).eq('id', shop.id as string)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function getGPS() {
    setGettingGPS(true)
    navigator.geolocation.getCurrentPosition(
      pos => { update('latitude', pos.coords.latitude); update('longitude', pos.coords.longitude); setGettingGPS(false) },
      () => setGettingGPS(false)
    )
  }

  if (noShop) return <div style={{ textAlign: 'center', padding: '80px 20px' }}><h2 style={{ marginBottom: 16 }}>No Shop Registered</h2><a href="/shopkeeper/register" className="btn btn-primary">Register Shop →</a></div>
  if (!shop) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div className="fade-in" style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>🏪 Shop Profile</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <span className={`badge ${shop.is_approved ? 'badge-green' : 'badge-yellow'}`}>{shop.is_approved ? '✅ Approved' : '⏳ Pending Approval'}</span>
        {!!(shop.is_approved) && <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={!!shop.is_open} onChange={e => update('is_open', e.target.checked)} /> Shop is Open</label>}
      </div>

      {saved && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, color: 'var(--success)', fontSize: '0.88rem' }}>✅ Changes saved!</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 18 }}>Basic Info</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group"><label className="input-label">Shop Name</label><input className="input" value={shop.name as string || ''} onChange={e => update('name', e.target.value)} /></div>
          <div className="input-group"><label className="input-label">Category</label>
            <select className="input" value={shop.category as string || 'Other'} onChange={e => update('category', e.target.value)}>
              {SHOP_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="input-group"><label className="input-label">Description</label><textarea className="input" rows={3} value={shop.description as string || ''} onChange={e => update('description', e.target.value)} /></div>
          <div className="input-group"><label className="input-label">Phone</label><input className="input" value={shop.phone as string || ''} onChange={e => update('phone', e.target.value)} /></div>
          <div className="input-group">
            <label className="input-label">Gender (Personal)</label>
            <select className="input" value={gender} onChange={e => setGender(e.target.value)} style={{ width: '100%' }}>
              <option value="">Select Gender</option>
              <option value="male">👨 Male</option>
              <option value="female">👩 Female</option>
              <option value="other">🌈 Other</option>
              <option value="prefer_not_to_say">🤐 Prefer not to say</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 18 }}>Address & GPS</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group"><label className="input-label">Address</label><input className="input" value={shop.address_line1 as string || ''} onChange={e => update('address_line1', e.target.value)} /></div>
          <div className="input-group"><label className="input-label">Landmark</label><input className="input" value={shop.landmark as string || ''} onChange={e => update('landmark', e.target.value)} /></div>
          <div className="input-group"><label className="input-label">City</label><input className="input" value={shop.city as string || ''} onChange={e => update('city', e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={getGPS} disabled={gettingGPS}>{gettingGPS ? '📡 Detecting...' : '📍 Update GPS'}</button>
            {shop.latitude ? <span style={{ fontSize: '0.82rem', color: 'var(--success)' }}>✅ {(shop.latitude as number).toFixed(5)}, {(shop.longitude as number).toFixed(5)}</span> : null}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 18 }}>💰 Payout Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group"><label className="input-label">UPI ID</label><input className="input" value={shop.upi_id as string || ''} onChange={e => update('upi_id', e.target.value)} placeholder="yourname@upi" /></div>
          <div className="input-group"><label className="input-label">Bank Account Number</label><input className="input" value={shop.bank_account_number as string || ''} onChange={e => update('bank_account_number', e.target.value)} /></div>
          <div className="input-group"><label className="input-label">IFSC Code</label><input className="input" value={shop.bank_ifsc as string || ''} onChange={e => update('bank_ifsc', e.target.value)} /></div>
        </div>
      </div>

      <button className="btn btn-primary btn-full btn-lg" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save All Changes'}</button>
    </div>
  )
}
