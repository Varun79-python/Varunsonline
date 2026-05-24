'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { submitShopkeeperDocuments } from '@/app/admin/actions'

const SHOP_CATEGORIES = [
  'Grocery', 'Vegetables & Fruits', 'Dairy & Eggs', 'Bakery',
  'Meat & Seafood', 'Pharmacy', 'Electronics', 'Clothing & Apparel',
  'Stationery', 'Home & Kitchen', 'Beauty & Personal Care',
  'Restaurants & Food', 'Hardware', 'Books', 'Other'
]

export default function ShopDocumentsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Shop info fields
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [category, setCategory] = useState('')

  // GPS state
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState('')

  // File state — local preview + uploaded URL
  const [shopImageFile, setShopImageFile] = useState<File | null>(null)
  const [shopImagePreview, setShopImagePreview] = useState('')
  const [shopImageUrl, setShopImageUrl] = useState('')
  const [shopImageUploading, setShopImageUploading] = useState(false)

  const [aadharFile, setAadharFile] = useState<File | null>(null)
  const [aadharPreview, setAadharPreview] = useState('')
  const [aadharUrl, setAadharUrl] = useState('')
  const [aadharUploading, setAadharUploading] = useState(false)

  const MAX_FILE_SIZE = 5 * 1024 * 1024

  const checkAuth = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login/shopkeeper'); return }

      setUserId(user.id)

      // Pre-fill owner name from profile
      const { data: profile } = await supabase
        .from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      if (profile?.full_name) setOwnerName(profile.full_name)

      // Already submitted? → go to status
      const { data: existingDocs } = await supabase
        .from('shop_documents').select('id').eq('user_id', user.id).maybeSingle()
      if (existingDocs) { router.replace('/login/status'); return }

      setLoading(false)
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => { checkAuth() }, [checkAuth])

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => router.replace('/login/status'), 2000)
      return () => clearTimeout(t)
    }
  }, [done, router])

  // ── GPS Capture ─────────────────────────────────────────────────────────────
  function captureGPS() {
    setGpsError('')
    setGpsLoading(true)

    if (!navigator.geolocation) {
      setGpsError('GPS not supported on this device.')
      setGpsLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude)
        setLongitude(pos.coords.longitude)
        setGpsLoading(false)
        setGpsError('')
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: 'Location permission denied. Please allow location access and try again.',
          2: 'Location unavailable. Please try again outside or near a window.',
          3: 'GPS timed out. Please try again.',
        }
        setGpsError(msgs[err.code] || 'Failed to get location.')
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  // ── Upload helpers ──────────────────────────────────────────────────────────
  async function uploadToStorage(file: File, bucket: string, docType: string): Promise<string | null> {
    if (!userId) return null
    const ext = file.name.split('.').pop()
    const path = `${userId}/${docType}_${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file)
    if (uploadError) {
      const msg = uploadError.message.includes('row-level security')
        ? 'Storage permissions denied. Please contact support.'
        : uploadError.message
      setError('Upload failed: ' + msg)
      return null
    }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
    return publicUrl
  }

  function handleShopImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) { setError('Shop image too large. Max 5MB.'); return }
    setShopImageFile(file)
    setShopImagePreview(URL.createObjectURL(file))
    setShopImageUrl('')
    setError('')
    setShopImageUploading(true)
    uploadToStorage(file, 'shop-images', 'shop_image').then(url => {
      setShopImageUploading(false)
      if (url) setShopImageUrl(url)
    })
  }

  function handleAadharSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) { setError('Aadhaar image too large. Max 5MB.'); return }
    setAadharFile(file)
    setAadharPreview(URL.createObjectURL(file))
    setAadharUrl('')
    setError('')
    setAadharUploading(true)
    uploadToStorage(file, 'shop-documents', 'aadhar').then(url => {
      setAadharUploading(false)
      if (url) setAadharUrl(url)
    })
  }

  // suppress unused-var lint for file state (kept for future use)
  void shopImageFile
  void aadharFile

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function submit() {
    setError('')
    if (!shopName.trim()) { setError('Please enter your shop name.'); return }
    if (!ownerName.trim()) { setError('Please enter the owner name.'); return }
    if (!category) { setError('Please select a shop category.'); return }
    if (latitude === null || longitude === null) {
      setError('Please capture your shop GPS location before submitting.')
      return
    }
    if (!shopImageUrl) { setError(shopImageUploading ? 'Shop image still uploading. Please wait.' : 'Please upload a photo of your shop.'); return }
    if (!aadharUrl) { setError(aadharUploading ? 'Aadhaar still uploading. Please wait.' : 'Please upload your Aadhaar card.'); return }

    setSaving(true)

    const result = await submitShopkeeperDocuments({
      shopPhotoUrl: shopImageUrl,
      aadharUrl,
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      category,
      latitude,
      longitude,
    })

    if (result.error) {
      if (result.error === 'already_submitted') { router.replace('/login/status'); return }
      setError('Failed to submit: ' + result.error)
      setSaving(false)
      return
    }

    setDone(true)
    setSaving(false)
  }

  // ── UI States ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b' }}>Loading...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  if (loadError) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', background: 'white', padding: 40, borderRadius: 20, maxWidth: 400 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
        <p style={{ color: '#64748b', marginBottom: 24 }}>{loadError}</p>
        <button onClick={() => checkAuth()} style={{ padding: '12px 24px', background: '#f97316', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', width: '100%', marginBottom: 10 }}>🔄 Try Again</button>
        <button onClick={() => router.replace('/login/shopkeeper')} style={{ padding: '12px 24px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer', width: '100%' }}>← Back to Login</button>
      </div>
    </div>
  )

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', background: 'white', borderRadius: 20, padding: 32, maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Application Submitted!</h2>
        <p style={{ color: '#64748b', lineHeight: 1.6 }}>
          Your shop details and documents have been sent to admin for review.<br /><br />
          You will be notified once approved. Redirecting...
        </p>
      </div>
    </div>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid #e2e8f0', fontSize: '0.95rem',
    background: 'white', boxSizing: 'border-box', outline: 'none',
    fontFamily: 'inherit'
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.82rem', fontWeight: 700,
    color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em'
  }
  const gpsConfirmed = latitude !== null && longitude !== null

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', padding: '20px 16px 28px' }}>
        <button onClick={() => router.replace('/login/shopkeeper')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem', marginBottom: 12 }}>← Back</button>
        <h1 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>🏪 Shop Registration</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', marginTop: 4, marginBottom: 0 }}>Fill in your shop details and upload documents for admin approval</p>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px' }}>

        {/* ── Shop Info ─────────────────────────────────────────────────────── */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginTop: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#fff7ed', borderRadius: 8, padding: '4px 8px' }}>📋</span>
            Shop Information
          </h3>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Shop Name *</label>
            <input type="text" placeholder="e.g. Raju General Store" value={shopName} onChange={e => setShopName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Owner Name *</label>
            <input type="text" placeholder="Your full name" value={ownerName} onChange={e => setOwnerName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 4 }}>
            <label style={labelStyle}>Shop Category *</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, color: category ? '#0f172a' : '#94a3b8' }}>
              <option value="" disabled>Select category...</option>
              {SHOP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* ── GPS Location ──────────────────────────────────────────────────── */}
        <div style={{
          background: 'white', borderRadius: 16, padding: 20, marginTop: 16,
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          border: `1.5px solid ${gpsConfirmed ? '#22c55e' : '#f1f5f9'}`
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#f0fdf4', borderRadius: 8, padding: '4px 8px' }}>📍</span>
            Shop Location *
          </h3>
          <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 16, lineHeight: 1.55 }}>
            Stand inside or directly in front of your shop, then tap the button below to capture your exact location. This helps customers find your shop on the map.
          </p>

          <button
            type="button"
            onClick={captureGPS}
            disabled={gpsLoading}
            style={{
              width: '100%', padding: '14px 16px',
              background: gpsConfirmed ? 'linear-gradient(135deg,#22c55e,#16a34a)' : gpsLoading ? '#94a3b8' : 'linear-gradient(135deg,#f97316,#ea580c)',
              color: 'white', border: 'none', borderRadius: 12,
              fontSize: '0.95rem', fontWeight: 700,
              cursor: gpsLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: gpsLoading ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'background 0.2s ease'
            }}
          >
            {gpsLoading ? (
              <>
                <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                Getting your location…
              </>
            ) : gpsConfirmed ? (
              '✅ Location Captured — Tap to Recapture'
            ) : (
              '📍 Capture My Shop Location'
            )}
          </button>

          {gpsConfirmed && (
            <div style={{ marginTop: 14, background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.85rem', marginBottom: 6 }}>✅ Location captured successfully</div>
              <div style={{ fontSize: '0.77rem', color: '#475569', fontFamily: 'monospace', marginBottom: 8 }}>
                Lat: {latitude!.toFixed(6)} &nbsp;|&nbsp; Lng: {longitude!.toFixed(6)}
              </div>
              <a
                href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
              >
                🗺️ Verify on Google Maps →
              </a>
            </div>
          )}

          {gpsError && (
            <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: '0.82rem', color: '#dc2626', fontWeight: 600 }}>
              ⚠️ {gpsError}
            </div>
          )}
        </div>

        {/* ── Shop Photo ────────────────────────────────────────────────────── */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginTop: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#fff7ed', borderRadius: 8, padding: '4px 8px' }}>📸</span>
            Shop Photo *
          </h3>
          <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 14 }}>Take a clear photo of your shop with the shop name board visible. Max 5MB.</p>
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="file" accept="image/*" onChange={handleShopImageSelect} style={{ display: 'none' }} />
            <div style={{ border: `2px dashed ${shopImageUrl ? '#22c55e' : '#e2e8f0'}`, borderRadius: 12, padding: shopImagePreview ? 8 : 28, textAlign: 'center', background: shopImageUrl ? '#f0fdf4' : shopImagePreview ? '#fefce8' : '#f8fafc' }}>
              {shopImagePreview ? (
                <div>
                  <img src={shopImagePreview} alt="Shop" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
                  {shopImageUploading ? <div style={{ color: '#f97316', fontSize: '0.82rem', fontWeight: 600 }}>⏳ Uploading...</div>
                    : shopImageUrl ? <div style={{ color: '#16a34a', fontSize: '0.82rem', fontWeight: 600 }}>✅ Uploaded — tap to change</div>
                    : <div style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 600 }}>❌ Upload failed — tap to retry</div>}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📷</div>
                  <div style={{ color: '#374151', fontWeight: 600, fontSize: '0.9rem' }}>Tap to upload shop photo</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>JPEG / PNG / WebP</div>
                </div>
              )}
            </div>
          </label>
        </div>

        {/* ── Aadhaar ───────────────────────────────────────────────────────── */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginTop: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#fff7ed', borderRadius: 8, padding: '4px 8px' }}>🪪</span>
            Aadhaar Card *
          </h3>
          <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 14 }}>Upload a clear photo of your Aadhaar card (front side). Max 5MB.</p>
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="file" accept="image/*" onChange={handleAadharSelect} style={{ display: 'none' }} />
            <div style={{ border: `2px dashed ${aadharUrl ? '#22c55e' : '#e2e8f0'}`, borderRadius: 12, padding: aadharPreview ? 8 : 28, textAlign: 'center', background: aadharUrl ? '#f0fdf4' : aadharPreview ? '#fefce8' : '#f8fafc' }}>
              {aadharPreview ? (
                <div>
                  <img src={aadharPreview} alt="Aadhaar" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
                  {aadharUploading ? <div style={{ color: '#f97316', fontSize: '0.82rem', fontWeight: 600 }}>⏳ Uploading...</div>
                    : aadharUrl ? <div style={{ color: '#16a34a', fontSize: '0.82rem', fontWeight: 600 }}>✅ Uploaded — tap to change</div>
                    : <div style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 600 }}>❌ Upload failed — tap to retry</div>}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🪪</div>
                  <div style={{ color: '#374151', fontWeight: 600, fontSize: '0.9rem' }}>Tap to upload Aadhaar photo</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>JPEG / PNG / WebP</div>
                </div>
              )}
            </div>
          </label>
        </div>

        {/* ── Error & Submit ────────────────────────────────────────────────── */}
        {error && (
          <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#dc2626', fontSize: '0.88rem', fontWeight: 600, marginTop: 16 }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={saving || shopImageUploading || aadharUploading}
          style={{
            width: '100%', marginTop: 20, padding: '16px',
            background: (saving || shopImageUploading || aadharUploading) ? '#94a3b8' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            color: 'white', border: 'none', borderRadius: 14,
            fontSize: '1rem', fontWeight: 700,
            cursor: (saving || shopImageUploading || aadharUploading) ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 16px rgba(249,115,22,0.3)'
          }}
        >
          {saving ? 'Submitting...' : (shopImageUploading || aadharUploading) ? 'Uploading files...' : 'Submit for Admin Approval →'}
        </button>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', marginTop: 14, lineHeight: 1.5 }}>
          Your details will be reviewed by admin within 24–48 hours.<br />
          You will receive a notification once approved.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}