'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SHOP_CATEGORIES = ['Grocery', 'Pharmacy', 'Bakery', 'Restaurant', 'Electronics', 'Clothing', 'Stationery', 'Other']

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
      pos => {
        const { latitude, longitude, accuracy } = pos.coords
        update('latitude', latitude)
        update('longitude', longitude)
        setGettingGPS(false)
        if (accuracy > 100) {
          alert(`⚠️ GPS accuracy is poor (±${Math.round(accuracy)}m). Shop location may be inaccurate. Move outside and retry.`)
        }
      },
      err => {
        setGettingGPS(false)
        alert('GPS failed: ' + (err.code === 1 ? 'Permission denied.' : err.code === 2 ? 'Position unavailable.' : 'Timed out.'))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    )
  }

  if (noShop) return <div style={{ textAlign: 'center', padding: '80px 20px' }}><h2 style={{ marginBottom: 16 }}>No Shop Registered</h2><a href="/shopkeeper/register" style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>Register Shop →</a></div>
  if (!shop) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ padding: '0 12px', maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8, fontSize: '1.2rem' }}>🏪 Shop Profile</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ background: shop.is_approved ? '#dcfce7' : '#fef3c7', color: shop.is_approved ? '#16a34a' : '#d97706', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>{shop.is_approved ? '✓ Approved' : '⏳ Pending'}</span>
        {!!(shop.is_approved) && <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}><input type="checkbox" checked={!!shop.is_open} onChange={e => update('is_open', e.target.checked)} /> Shop Open</label>}
      </div>

      {saved && <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: 12, marginBottom: 16, color: '#16a34a', fontSize: '0.85rem', fontWeight: 600 }}>✓ Changes saved!</div>}

      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>Basic Info</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Shop Name</label><input value={shop.name as string || ''} onChange={e => update('name', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Category</label>
            <select value={shop.category as string || 'Other'} onChange={e => update('category', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }}>
              {SHOP_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label><textarea rows={3} value={shop.description as string || ''} onChange={e => update('description', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Phone</label><input value={shop.phone as string || ''} onChange={e => update('phone', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Gender</label>
            <select value={gender} onChange={e => setGender(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>📍 Address & Location</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Address</label><input value={shop.address_line1 as string || ''} onChange={e => update('address_line1', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Landmark</label><input value={shop.landmark as string || ''} onChange={e => update('landmark', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>City</label><input value={shop.city as string || ''} onChange={e => update('city', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} /></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
            <button onClick={getGPS} disabled={gettingGPS} style={{ background: gettingGPS ? '#fef3c7' : '#f1f5f9', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem', fontWeight: 600, color: '#475569', cursor: gettingGPS ? 'not-allowed' : 'pointer' }}>{gettingGPS ? '📡 Detecting...' : '📍 Update GPS'}</button>
            {shop.latitude ? <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>✓ {(shop.latitude as number).toFixed(4)}, {(shop.longitude as number).toFixed(4)}</span> : null}
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 16, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>💰 Payout Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>UPI ID</label><input value={shop.upi_id as string || ''} onChange={e => update('upi_id', e.target.value)} placeholder="yourname@upi" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Bank Account</label><input value={shop.bank_account_number as string || ''} onChange={e => update('bank_account_number', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>IFSC Code</label><input value={shop.bank_ifsc as string || ''} onChange={e => update('bank_ifsc', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} /></div>
        </div>
      </div>

      <button onClick={save} disabled={saving} style={{ width: '100%', background: '#f97316', color: 'white', border: 'none', borderRadius: 12, padding: '16px', fontWeight: 800, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Save All Changes'}
      </button>
    </div>
  )
}
