'use client'
/**
 * components/shared/ShopLocationBar.tsx
 * Shows verified GPS shop location. Supports reverse geocoding + GPS correction modal.
 */
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/modules/infrastructure/supabase/client'

interface ShopData {
  id: string
  name: string
  address_line1: string | null
  address_line2: string | null
  landmark: string | null
  city: string | null
  state: string | null
  pincode: string | null
  latitude: number | null
  longitude: number | null
  category: string | null
}

// ── Reverse geocode via Nominatim (free, no key needed) ─────────────────────
async function reverseGeocode(lat: number, lon: number): Promise<{ area: string; city: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`,
      { headers: { 'Accept-Language': 'en' } }
    )
    if (!res.ok) return null
    const d = await res.json()
    const addr = d.address || {}
    const area =
      addr.suburb || addr.neighbourhood || addr.village ||
      addr.town || addr.county || addr.road || ''
    const city = addr.city || addr.town || addr.county || addr.state_district || addr.state || ''
    return { area, city }
  } catch {
    return null
  }
}

export default function ShopLocationBar() {
  const supabase = createClient()
  const [shop, setShop] = useState<ShopData | null>(null)
  const [loading, setLoading] = useState(true)

  // Reverse geocoded locality
  const [locality, setLocality] = useState<{ area: string; city: string } | null>(null)
  const [geocoded, setGeocoded] = useState(false)

  // Edit GPS modal state
  const [showModal, setShowModal] = useState(false)
  const [newLat, setNewLat] = useState<number | null>(null)
  const [newLng, setNewLng] = useState<number | null>(null)
  const [gpsCapturing, setGpsCapturing] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  // Load shop
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('shops')
        .select('id, name, address_line1, address_line2, landmark, city, state, pincode, latitude, longitude, category')
        .eq('owner_id', user.id)
        .maybeSingle()
      if (data) setShop(data)
      setLoading(false)
    }
    load()
  }, [supabase])

  // Reverse geocode once after shop loads — only if GPS exists
  useEffect(() => {
    if (!shop || geocoded) return
    if (shop.latitude == null || shop.longitude == null) { setGeocoded(true); return }
    setGeocoded(true) // prevent re-runs
    reverseGeocode(shop.latitude, shop.longitude).then(result => {
      if (result) setLocality(result)
    })
  }, [shop, geocoded])

  const getAuthHeader = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }, [supabase])

  // ── GPS Capture in modal ──────────────────────────────────────────────────
  function captureGPS() {
    setGpsError('')
    setGpsCapturing(true)
    setConfirmed(false)
    if (!navigator.geolocation) {
      setGpsError('GPS not supported on this device.')
      setGpsCapturing(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewLat(pos.coords.latitude)
        setNewLng(pos.coords.longitude)
        setGpsCapturing(false)
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: 'Location permission denied. Please allow location access.',
          2: 'Location unavailable. Move to an open area and retry.',
          3: 'GPS timed out. Please try again.',
        }
        setGpsError(msgs[err.code] || 'Failed to get location.')
        setGpsCapturing(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  // ── Save updated GPS ──────────────────────────────────────────────────────
  async function saveLocation() {
    if (newLat === null || newLng === null) return
    setSaving(true)
    setSaveError('')
    try {
      const headers = await getAuthHeader()
      const res = await fetch('/api/shopkeeper/update-location', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ latitude: newLat, longitude: newLng }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error || 'Failed to save'); setSaving(false); return }

      // Optimistic update — reflect immediately in UI
      setShop(s => s ? { ...s, latitude: newLat, longitude: newLng } : s)
      // Re-reverse geocode with new coordinates
      setGeocoded(false)
      setLocality(null)
      setShowModal(false)
      setNewLat(null)
      setNewLng(null)
      setConfirmed(false)
    } catch {
      setSaveError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function openModal() {
    setNewLat(null)
    setNewLng(null)
    setGpsError('')
    setSaveError('')
    setConfirmed(false)
    setShowModal(true)
  }

  if (loading) return (
    <div className="sloc-bar">
      <div className="sloc-skeleton">
        <div className="skeleton" style={{ width: 120, height: 16, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 200, height: 12, borderRadius: 6, marginTop: 6 }} />
      </div>
    </div>
  )

  if (!shop) return null

  const hasGPS = shop.latitude != null && shop.longitude != null
  const mapsUrl = hasGPS
    ? `https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`
    : `https://maps.google.com/search?q=${encodeURIComponent([shop.address_line1, shop.city].filter(Boolean).join(', ') || shop.name)}`

  const fullAddress = [shop.address_line1, shop.address_line2, shop.landmark, shop.city, shop.state, shop.pincode].filter(Boolean).join(', ')
  const displayArea = locality?.area || shop.landmark || shop.address_line1 || ''
  const displayCity = locality?.city || shop.city || ''
  const displayLine = [displayArea, displayCity].filter(Boolean).join(', ') || fullAddress || shop.name

  // New GPS preview maps URL
  const newMapsUrl = newLat !== null && newLng !== null
    ? `https://www.google.com/maps?q=${newLat},${newLng}`
    : null

  return (
    <>
      {/* ── DESKTOP VERSION ────────────────────────────────────────────── */}
      <div className="sloc-bar sloc-desktop">
        <div className="sloc-inner">
          <div className="sloc-left">
            <div className="sloc-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="sloc-text">
              <div className="sloc-title">
                Shop Location
                {hasGPS
                  ? <span className="sloc-badge sloc-badge-verified">🟢 Verified</span>
                  : <span className="sloc-badge sloc-badge-unverified">⚠️ Not Verified</span>
                }
              </div>
              <div className="sloc-addr">{displayLine || 'No address set'}</div>
              {hasGPS && <div className="sloc-serving">📍 Serving nearby customers</div>}
              {!hasGPS && <div className="sloc-unverified-cta">Tap &ldquo;Update Location&rdquo; to verify your shop on the map</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {hasGPS && (
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="sloc-map-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
                View on Map
              </a>
            )}
            <button onClick={openModal} className="sloc-edit-btn">
              📍 {hasGPS ? 'Update Location' : 'Verify Location'}
            </button>
          </div>
        </div>
      </div>

      {/* ── MOBILE VERSION ─────────────────────────────────────────────── */}
      <div className="sloc-bar sloc-mobile">
        <div className="sloc-mobile-row">
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="sloc-mobile-link" style={{ flex: 1 }}>
            <div className="sloc-mobile-dot">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#f97316" stroke="none">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" fill="white" />
              </svg>
            </div>
            <div className="sloc-mobile-text">
              <span className="sloc-mobile-title">
                📍 {displayArea || shop.name}
                {hasGPS
                  ? <span style={{ fontSize: '0.62rem', background: '#dcfce7', color: '#16a34a', borderRadius: 4, padding: '1px 5px', marginLeft: 5, fontWeight: 700, verticalAlign: 'middle' }}>✓</span>
                  : <span style={{ fontSize: '0.62rem', background: '#fef3c7', color: '#d97706', borderRadius: 4, padding: '1px 5px', marginLeft: 5, fontWeight: 700, verticalAlign: 'middle' }}>!</span>
                }
              </span>
              <span className="sloc-mobile-locality">{displayCity || fullAddress}</span>
            </div>
          </a>
          <button onClick={openModal} className="sloc-mobile-edit-btn" title="Update location">
            ✏️
          </button>
        </div>
      </div>

      {/* ── UPDATE GPS MODAL ────────────────────────────────────────────── */}
      {showModal && (
        <div
          id="location-modal-overlay"
          onClick={(e) => { if ((e.target as HTMLElement).id === 'location-modal-overlay') setShowModal(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
            backdropFilter: 'blur(3px)', zIndex: 500,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '0 0 0 0'
          }}
        >
          <div style={{
            background: 'white', borderRadius: '20px 20px 0 0',
            width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
            animation: 'slideUp 0.25s ease'
          }}>
            {/* Modal header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>📍 Update Shop GPS Location</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>Stand at your shop and capture your exact location</div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: '1rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ padding: '18px 20px' }}>
              {/* Current location */}
              {hasGPS && (
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>📌 Current saved location</div>
                  <div style={{ fontSize: '0.77rem', color: '#64748b', fontFamily: 'monospace', marginBottom: 6 }}>
                    Lat: {shop.latitude!.toFixed(6)} | Lng: {shop.longitude!.toFixed(6)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 6 }}>{displayLine}</div>
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>🗺️ View current on Google Maps →</a>
                </div>
              )}

              {/* Warning */}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '0.8rem', color: '#92400e', lineHeight: 1.5 }}>
                ⚠️ <strong>Make sure you are physically standing at your shop</strong> before capturing. This will replace your current shop pin on the map.
              </div>

              {/* Capture button */}
              <button
                onClick={captureGPS}
                disabled={gpsCapturing}
                style={{
                  width: '100%', padding: '14px',
                  background: gpsCapturing ? '#94a3b8' : newLat !== null ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #f97316, #ea580c)',
                  color: 'white', border: 'none', borderRadius: 12,
                  fontSize: '0.95rem', fontWeight: 700,
                  cursor: gpsCapturing ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  marginBottom: 12
                }}
              >
                {gpsCapturing ? (
                  <>
                    <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Getting precise location…
                  </>
                ) : newLat !== null ? (
                  '📍 Recapture GPS'
                ) : (
                  '📍 Capture Current GPS'
                )}
              </button>

              {/* GPS error */}
              {gpsError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: '0.82rem', color: '#dc2626', fontWeight: 600 }}>
                  ⚠️ {gpsError}
                </div>
              )}

              {/* New location preview */}
              {newLat !== null && newLng !== null && (
                <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.85rem', marginBottom: 6 }}>✅ New location captured</div>
                  <div style={{ fontSize: '0.77rem', color: '#475569', fontFamily: 'monospace', marginBottom: 8 }}>
                    Lat: {newLat.toFixed(6)} | Lng: {newLng.toFixed(6)}
                  </div>
                  {newMapsUrl && (
                    <a href={newMapsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                      🗺️ Verify on Google Maps →
                    </a>
                  )}

                  {/* Confirmation checkbox */}
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={e => setConfirmed(e.target.checked)}
                      style={{ marginTop: 2, accentColor: '#f97316', width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#374151', lineHeight: 1.5 }}>
                      I confirm I am standing at my shop and want to replace my current shop location with this new pin.
                    </span>
                  </label>
                </div>
              )}

              {/* Save error */}
              {saveError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: '0.82rem', color: '#dc2626', fontWeight: 600 }}>
                  ❌ {saveError}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '14px', background: '#f1f5f9', border: 'none', borderRadius: 12, color: '#475569', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveLocation}
                  disabled={newLat === null || !confirmed || saving}
                  style={{
                    flex: 2, padding: '14px',
                    background: (newLat === null || !confirmed || saving) ? '#94a3b8' : 'linear-gradient(135deg, #f97316, #ea580c)',
                    color: 'white', border: 'none', borderRadius: 12,
                    fontWeight: 700, fontSize: '0.9rem',
                    cursor: (newLat === null || !confirmed || saving) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving ? '⏳ Saving…' : '✅ Save Updated Location'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sloc-bar {
          width: 100%;
          background: white;
          border-bottom: 1px solid #f1f5f9;
        }
        .sloc-desktop {
          display: block;
          padding: 10px 24px;
          position: sticky;
          top: 60px;
          z-index: 40;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .sloc-mobile { display: none; }
        .sloc-skeleton { padding: 12px 0; display: flex; flex-direction: column; }
        .sloc-inner {
          display: flex; align-items: center;
          justify-content: space-between; gap: 16px;
          max-width: 1280px; margin: 0 auto;
        }
        .sloc-left { display: flex; align-items: flex-start; gap: 12px; min-width: 0; flex: 1; }
        .sloc-icon-wrap {
          flex-shrink: 0; width: 38px; height: 38px;
          background: #fff7ed; border-radius: 10px;
          display: flex; align-items: center; justify-content: center; margin-top: 2px;
        }
        .sloc-text { min-width: 0; flex: 1; }
        .sloc-title {
          font-size: 0.88rem; font-weight: 700; color: #0f172a;
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        }
        .sloc-badge {
          font-size: 0.65rem; font-weight: 700; padding: 2px 7px;
          border-radius: 20px; white-space: nowrap;
        }
        .sloc-badge-verified { background: #dcfce7; color: #16a34a; }
        .sloc-badge-unverified { background: #fef3c7; color: #d97706; }
        .sloc-addr {
          font-size: 0.78rem; color: #64748b; margin-top: 2px;
          line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sloc-serving { font-size: 0.72rem; color: #16a34a; font-weight: 600; margin-top: 4px; }
        .sloc-unverified-cta { font-size: 0.72rem; color: #d97706; font-weight: 600; margin-top: 4px; }
        .sloc-map-btn {
          flex-shrink: 0; display: flex; align-items: center; gap: 6px;
          background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1;
          padding: 8px 12px; border-radius: 8px; font-size: 0.78rem;
          font-weight: 700; cursor: pointer; white-space: nowrap;
          text-decoration: none; font-family: inherit; transition: all 0.15s;
        }
        .sloc-map-btn:hover { background: #e0f2fe; border-color: #7dd3fc; }
        .sloc-edit-btn {
          flex-shrink: 0; display: flex; align-items: center; gap: 6px;
          background: #fff7ed; border: 1px solid #fed7aa; color: #ea580c;
          padding: 8px 12px; border-radius: 8px; font-size: 0.78rem;
          font-weight: 700; cursor: pointer; white-space: nowrap;
          font-family: inherit; transition: all 0.15s;
        }
        .sloc-edit-btn:hover { background: #ffedd5; border-color: #fb923c; }

        /* ── Mobile ── */
        .sloc-mobile-row {
          display: flex; align-items: center;
          padding: 10px 16px; gap: 8px;
          padding-top: calc(10px + env(safe-area-inset-top, 0px));
        }
        .sloc-mobile-link {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none; color: inherit;
          -webkit-tap-highlight-color: transparent; flex: 1; min-width: 0;
        }
        .sloc-mobile-dot {
          flex-shrink: 0; width: 32px; height: 32px;
          background: #fff7ed; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }
        .sloc-mobile-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .sloc-mobile-title { font-size: 0.82rem; font-weight: 700; color: #0f172a; }
        .sloc-mobile-locality {
          font-size: 0.72rem; color: #64748b;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;
        }
        .sloc-mobile-edit-btn {
          flex-shrink: 0; background: #fff7ed; border: 1px solid #fed7aa;
          border-radius: 8px; padding: 6px 10px; cursor: pointer;
          font-size: 0.9rem; transition: background 0.15s;
        }
        .sloc-mobile-edit-btn:hover { background: #ffedd5; }

        @media (max-width: 768px) {
          .sloc-desktop { display: none !important; }
          .sloc-mobile {
            display: block !important;
            position: sticky; top: 0; z-index: 40;
            background: white; border-bottom: 1px solid #f1f5f9;
            box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </>
  )
}
