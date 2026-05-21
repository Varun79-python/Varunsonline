'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getReliableGPSPosition, type GPSLikeError } from '@/lib/gps'

const SHOP_CATEGORIES = ['Grocery', 'Pharmacy', 'Bakery', 'Restaurant', 'Electronics', 'Clothing', 'Stationery', 'Other']

export default function CompleteProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [shop, setShop] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [gettingGPS, setGettingGPS] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login/shopkeeper')
        return
      }
      
      const { data: shopData } = await supabase.from('shops').select('*').eq('owner_id', user.id).maybeSingle()
      
      if (!shopData || !shopData.is_approved || !shopData.is_active) {
        // Shop not approved yet — redirect to dashboard which handles this state
        router.replace('/shopkeeper')
        return
      }
      
      setShop(shopData)
      setLoading(false)
    }
    load()
  }, [])

  function update(key: string, value: unknown) {
    setShop(s => s ? { ...s, [key]: value } : s)
  }

  async function save() {
    if (!shop) return
    
    // Validate required fields
    if (!shop.name || !(shop.name as string).trim()) {
      setError('Shop Name is required')
      return
    }
    if (!shop.category) {
      setError('Category is required')
      return
    }
    if (!shop.city || !(shop.city as string).trim()) {
      setError('City is required')
      return
    }
    if (!shop.address_line1 || !(shop.address_line1 as string).trim()) {
      setError('Address is required')
      return
    }

    setSaving(true)
    setError('')
    
    try {
      const { error: updateError } = await supabase
        .from('shops')
        .update({
          name: shop.name,
          category: shop.category,
          description: shop.description || '',
          address_line1: shop.address_line1,
          landmark: shop.landmark || '',
          city: shop.city,
          phone: shop.phone || '',
          upi_id: shop.upi_id || '',
          bank_account_number: shop.bank_account_number || '',
          bank_ifsc: shop.bank_ifsc || '',
          latitude: shop.latitude || null,
          longitude: shop.longitude || null,
          is_profile_complete: true,
        })
        .eq('id', shop.id as string)
      
      if (updateError) {
        setError('Failed to save: ' + updateError.message)
        setSaving(false)
        return
      }
      
      setShowSuccess(true)
      setTimeout(() => {
        router.push('/shopkeeper')
      }, 2000)
    } catch (err: unknown) {
      setError('Error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  async function getGPS() {
    setGettingGPS(true)
    try {
      const pos = await getReliableGPSPosition()
      update('latitude', pos.coords.latitude)
      update('longitude', pos.coords.longitude)
      if (pos.coords.accuracy > 100) {
        alert(`⚠️ GPS accuracy is low (±${Math.round(pos.coords.accuracy)}m). Location may be approximate.`)
      }
    } catch (err: unknown) {
      const gpsError = err as GPSLikeError
      if (gpsError.code === 1) alert('GPS: Permission denied')
      else if (gpsError.code === 2) alert('GPS: Position unavailable')
      else alert('GPS: Request timed out')
    } finally {
      setGettingGPS(false)
    }
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} />
    </div>
  )

  return (
    <div style={{ padding: '0 16px', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏪</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Shop Setup</h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Fill in your shop details so customers can find you</p>
      </div>

      {/* Back to Dashboard */}
      <div style={{ marginBottom: 16 }}>
        <a
          href="/shopkeeper"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}
        >
          ← Back to Dashboard
        </a>
      </div>

      {/* Success message */}
      {showSuccess && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 10, padding: '16px', marginBottom: 16, color: '#16a34a', fontWeight: 700, textAlign: 'center' }}>
          ✅ Profile saved! Redirecting to dashboard...
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Basic Info */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16, fontSize: '1rem', fontWeight: 700 }}>Basic Information</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Shop Name *</label>
            <input 
              value={shop?.name as string || ''} 
              onChange={e => update('name', e.target.value)} 
              placeholder="e.g. Varun General Store"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Category *</label>
            <select 
              value={shop?.category as string || ''} 
              onChange={e => update('category', e.target.value)} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }}
            >
              <option value="">Select Category</option>
              {SHOP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Shop Description</label>
            <textarea 
              rows={3} 
              value={shop?.description as string || ''} 
              onChange={e => update('description', e.target.value)} 
              placeholder="Tell customers about your shop..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Phone Number</label>
            <input 
              value={shop?.phone as string || ''} 
              onChange={e => update('phone', e.target.value)} 
              placeholder="10-digit phone number"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} 
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16, fontSize: '1rem', fontWeight: 700 }}>📍 Address & Location</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Address *</label>
            <input 
              value={shop?.address_line1 as string || ''} 
              onChange={e => update('address_line1', e.target.value)} 
              placeholder="House/Building, Street"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Landmark</label>
            <input 
              value={shop?.landmark as string || ''} 
              onChange={e => update('landmark', e.target.value)} 
              placeholder="Near landmark (optional)"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>City *</label>
            <input 
              value={shop?.city as string || ''} 
              onChange={e => update('city', e.target.value)} 
              placeholder="City name"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} 
            />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button 
              onClick={getGPS} 
              disabled={gettingGPS}
              style={{ background: gettingGPS ? '#fef3c7' : '#f1f5f9', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem', fontWeight: 600, color: '#475569', cursor: gettingGPS ? 'not-allowed' : 'pointer' }}
            >
              {gettingGPS ? '📡 Detecting...' : '📍 Set Location'}
            </button>
            {Boolean(shop?.latitude) && (
              <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                ✓ {((shop as {latitude: number}).latitude).toFixed(4)}, {((shop as {longitude: number}).longitude).toFixed(4)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Payout Details */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 16, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16, fontSize: '1rem', fontWeight: 700 }}>💰 Payout Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>UPI ID</label>
            <input 
              value={shop?.upi_id as string || ''} 
              onChange={e => update('upi_id', e.target.value)} 
              placeholder="yourname@upi"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Bank Account Number</label>
            <input 
              value={shop?.bank_account_number as string || ''} 
              onChange={e => update('bank_account_number', e.target.value)} 
              placeholder="Account number"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>IFSC Code</label>
            <input 
              value={shop?.bank_ifsc as string || ''} 
              onChange={e => update('bank_ifsc', e.target.value)} 
              placeholder="IFSC code"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} 
            />
          </div>
        </div>
      </div>

      <button 
        onClick={save} 
        disabled={saving}
        style={{ 
          width: '100%', 
          background: saving ? '#94a3b8' : '#16a34a', 
          color: 'white', 
          border: 'none', 
          borderRadius: 12, 
          padding: '16px', 
          fontWeight: 800, 
          fontSize: '1rem', 
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1 
        }}
      >
        {saving ? 'Saving...' : '✅ Complete Profile & Start Selling'}
      </button>

      <div style={{ textAlign: 'center', marginTop: 16, marginBottom: 40 }}>
        <button 
          onClick={async () => { await supabase.auth.signOut(); router.push('/login/shopkeeper') }}
          style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          Logout &amp; return later
        </button>
      </div>
    </div>
  )
}