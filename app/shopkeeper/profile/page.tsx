'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SHOP_CATEGORIES = ['Grocery', 'Pharmacy', 'Bakery', 'Restaurant', 'Electronics', 'Clothing', 'Stationery', 'Other']

export default function ShopkeeperProfile() {
  const router = useRouter()
  const supabase = createClient()
  const [shop, setShop] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [gender, setGender] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [gettingGPS, setGettingGPS] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [gpsWarning, setGpsWarning] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: shopData } = await supabase.from('shops').select('*').eq('owner_id', user.id).maybeSingle()
      if (!shopData || !shopData.is_approved || !shopData.is_active) { router.replace('/login/status'); return }
      
      setShop(shopData)
      const { data: profile } = await supabase.from('profiles').select('gender').eq('id', user.id).single()
      if (profile?.gender) setGender(profile.gender)
      setLoading(false)
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
    if (!navigator.geolocation) {
      setGpsError('GPS is not supported on this device or browser.')
      return
    }
    setGettingGPS(true)
    setGpsError(null)
    setGpsWarning(null)
    console.log('[GPS/ShopProfile] Requesting location...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        console.log(`[GPS/ShopProfile] Success: lat=${latitude.toFixed(5)}, lon=${longitude.toFixed(5)}, accuracy=±${Math.round(accuracy)}m`)
        update('latitude', latitude)
        update('longitude', longitude)
        if (accuracy > 100) setGpsWarning(`⚠️ GPS accuracy is low (±${Math.round(accuracy)}m) — move to an open area for better precision.`)
        setGettingGPS(false)
      },
      (err) => {
        const code = err.code
        console.error(`[GPS/ShopProfile] Error code=${code}:`, err.message)
        if (code === 1) {
          setGpsError('Tap the 🔒 lock icon in the address bar → Site settings → Location → Allow, then try again.')
        } else if (code === 2) {
          setGpsError('Location unavailable — turn on device GPS and move to an open area.')
        } else {
          setGpsError('Location timed out — ensure GPS is on and try again.')
        }
        setGettingGPS(false)
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 }
    )
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
  if (!shop) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <h2 style={{ marginBottom: 16 }}>Shop Not Found</h2>
      <p style={{ marginBottom: 24 }}>Your registration may be pending or incomplete.</p>
      <a href="/login/status" style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>Check Status →</a>
    </div>
  )

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

          {/* GPS Box */}
          <div style={{ background: '#f8fafc', borderRadius: 10, border: '1.5px solid #e2e8f0', padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#374151', marginBottom: 10 }}>📡 GPS Location</div>

            {/* Saved location display */}
            {shop.latitude ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>✅ Saved Location</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#374151' }}>
                  Lat: {(shop.latitude as number).toFixed(6)}<br />
                  Lon: {(shop.longitude as number).toFixed(6)}
                </div>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${shop.latitude}&mlon=${shop.longitude}&zoom=17`}
                  target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: '0.78rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                >
                  🗺️ Check on Map (OpenStreetMap)
                </a>
              </div>
            ) : (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: '0.78rem', color: '#92400e' }}>
                ⚠️ No GPS saved — detect your shop location to help customers find you.
              </div>
            )}

            {/* Detect button */}
            <button
              onClick={getGPS}
              disabled={gettingGPS}
              style={{ width: '100%', background: gettingGPS ? '#f1f5f9' : 'linear-gradient(135deg, #f97316, #ea580c)', color: gettingGPS ? '#94a3b8' : 'white', border: 'none', borderRadius: 9, padding: '11px', fontWeight: 700, fontSize: '0.85rem', cursor: gettingGPS ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {gettingGPS ? '📡 Detecting GPS…' : '📍 Detect Current Location'}
            </button>

            {/* Error / warning */}
            {gpsError && <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 10px', lineHeight: 1.4 }}>🚫 {gpsError}</div>}
            {gpsWarning && <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#92400e', background: '#fef9c3', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 10px', lineHeight: 1.4 }}>{gpsWarning}</div>}
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
