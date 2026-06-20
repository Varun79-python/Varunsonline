'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/modules/infrastructure/supabase/client'
import LocationPicker, { type SavedLocation } from '@/modules/gps-location/components/LocationPicker'
import { uploadImage } from '@/modules/infrastructure/services/uploadImage'

const SHOP_CATEGORIES = ['Grocery', 'Pharmacy', 'Bakery', 'Restaurant', 'Electronics', 'Clothing', 'Stationery', 'Other']

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box',
}

interface ShopProfile {
  id: string
  owner_id: string
  name: string | null
  description: string | null
  category: string | null
  is_approved: boolean
  is_active: boolean
  is_open: boolean
  phone: string | null
  upi_id: string | null
  bank_account_number: string | null
  bank_ifsc: string | null
  address_line1: string | null
  landmark: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  gps_accuracy: number | null
  formatted_address: string | null
  shop_image_url?: string | null
  email?: string | null
  created_at?: string
}

export default function ShopkeeperProfile() {
  const router = useRouter()
  const supabase = createClient()
  const [shop, setShop] = useState<ShopProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [gender, setGender] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleShopImageUpload(file: File) {
    if (!shop) return
    setUploading(true)
    const result = await uploadImage(file, 'shop-images', 'shop_image', shop.id)
    if (result.success) {
      update('shop_image_url', result.publicUrl)
    } else {
      alert(result.error)
    }
    setUploading(false)
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shopData } = await supabase.from('shops').select('*').eq('owner_id', user.id).maybeSingle()
      if (!shopData || !shopData.is_approved || !shopData.is_active) {
        router.replace('/login/status'); return
      }
      setShop(shopData)
      const { data: profile } = await supabase.from('profiles').select('gender').eq('id', user.id).single()
      if (profile?.gender) setGender(profile.gender)
      setLoading(false)
    }
    load()
  }, [])

  function update<K extends keyof ShopProfile>(key: K, value: ShopProfile[K]) { setShop(s => s ? { ...s, [key]: value } : s) }

  async function save() {
    if (!shop) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ gender }).eq('id', user.id)
    await supabase.from('shops').update({
      name: shop.name, description: shop.description, category: shop.category,
      shop_image_url: shop.shop_image_url,
      address_line1: shop.address_line1, landmark: shop.landmark, city: shop.city,
      phone: shop.phone, upi_id: shop.upi_id,
      bank_account_number: shop.bank_account_number, bank_ifsc: shop.bank_ifsc,
      is_open: shop.is_open,
      latitude: shop.latitude, longitude: shop.longitude,
      gps_accuracy: shop.gps_accuracy, formatted_address: shop.formatted_address,
    }).eq('id', shop.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // Called by LocationPicker when user taps "Use This Location"
  function handleLocationUse(loc: SavedLocation) {
    update('latitude', loc.latitude)
    update('longitude', loc.longitude)
    if (loc.accuracy) update('gps_accuracy', loc.accuracy)
    if (loc.formattedAddress) update('formatted_address', loc.formattedAddress)
    if (loc.city && !shop?.city) update('city', loc.city)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>
  if (!shop) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <h2 style={{ marginBottom: 16 }}>Shop Not Found</h2>
      <p style={{ marginBottom: 24 }}>Your registration may be pending or incomplete.</p>
      <a href="/login/status" style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>Check Status →</a>
    </div>
  )

  const savedLoc: SavedLocation | null = (shop.latitude != null && shop.longitude != null)
    ? {
        latitude: shop.latitude,
        longitude: shop.longitude,
        accuracy: shop.gps_accuracy ?? undefined,
        formattedAddress: shop.formatted_address ?? undefined,
        city: shop.city ?? undefined,
      }
    : null

  return (
    <div style={{ padding: '0 12px', maxWidth: 600, margin: '0 auto', paddingBottom: 100 }}>
      <h2 style={{ marginBottom: 8, fontSize: '1.2rem' }}>🏪 Shop Profile</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ background: shop.is_approved ? '#dcfce7' : '#fef3c7', color: shop.is_approved ? '#16a34a' : '#d97706', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>
          {shop.is_approved ? '✓ Approved' : '⏳ Pending'}
        </span>
        {!!(shop.is_approved) && (
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            <input type="checkbox" checked={!!shop.is_open} onChange={e => update('is_open', e.target.checked)} />
            Shop Open
          </label>
        )}
      </div>

      {saved && <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: 12, marginBottom: 16, color: '#16a34a', fontSize: '0.85rem', fontWeight: 600 }}>✓ Changes saved!</div>}

      {/* Shop Image Banner */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>📸 Shop Photo</h3>
        {shop.shop_image_url ? (
          <div style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
            <img src={shop.shop_image_url} alt={shop.name ?? 'Shop'} loading="lazy" decoding="async"
              style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 10, display: 'block' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        ) : (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: 10, marginBottom: 12, fontSize: '3rem', color: '#cbd5e1' }}>
            🏪
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleShopImageUpload(file)
              e.target.value = ''
            }}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
            style={{ padding: '10px 16px', background: uploading ? '#94a3b8' : '#f1f5f9', border: '1.5px dashed #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            {uploading ? '⏳ Uploading...' : '📷 Upload Photo'}
          </button>
          <input value={shop.shop_image_url ?? ''} onChange={e => update('shop_image_url', e.target.value)}
            placeholder="Or paste image URL..." style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', minWidth: 0 }} />
        </div>
      </div>

      {/* Basic Info */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>Basic Info</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Shop Name</label>
            <input value={shop.name ?? ''} onChange={e => update('name', e.target.value)} style={inp} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Category</label>
            <select value={shop.category ?? 'Other'} onChange={e => update('category', e.target.value)} style={inp}>
              {SHOP_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea rows={3} value={shop.description ?? ''} onChange={e => update('description', e.target.value)} style={{ ...inp, resize: 'vertical' }} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Phone</label>
            <input value={shop.phone ?? ''} onChange={e => update('phone', e.target.value)} style={inp} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Gender</label>
            <select value={gender} onChange={e => setGender(e.target.value)} style={inp}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select></div>
        </div>
      </div>

      {/* Address & GPS */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>📍 Address &amp; Location</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Address</label>
            <input value={shop.address_line1 ?? ''} onChange={e => update('address_line1', e.target.value)} style={inp} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Landmark</label>
            <input value={shop.landmark ?? ''} onChange={e => update('landmark', e.target.value)} style={inp} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>City</label>
            <input value={shop.city ?? ''} onChange={e => update('city', e.target.value)} style={inp} /></div>
          <LocationPicker saved={savedLoc} onUse={handleLocationUse} />
        </div>
      </div>

      {/* Payout */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 16, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>💰 Payout Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>UPI ID</label>
            <input value={shop.upi_id ?? ''} onChange={e => update('upi_id', e.target.value)} placeholder="yourname@upi" style={inp} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Bank Account</label>
            <input value={shop.bank_account_number ?? ''} onChange={e => update('bank_account_number', e.target.value)} style={inp} /></div>
          <div><label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>IFSC Code</label>
            <input value={shop.bank_ifsc ?? ''} onChange={e => update('bank_ifsc', e.target.value)} style={inp} /></div>
        </div>
      </div>

      <button onClick={save} disabled={saving} style={{ width: '100%', background: '#f97316', color: 'white', border: 'none', borderRadius: 12, padding: '16px', fontWeight: 800, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving…' : 'Save All Changes'}
      </button>
    </div>
  )
}
