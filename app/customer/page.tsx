'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCustomerGPSError, getCustomerGPSPosition } from '@/lib/customerGps'

interface Shop {
  id: string; name: string; category: string; description: string
  shop_image_url: string; rating: number; total_orders: number
  address_line1: string; city: string; latitude: number; longitude: number
  distance?: number | null
  shop_rating?: number | null
  delivery_rating?: number | null
  total_ratings?: number | null
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const CATEGORIES = [
  { label: 'All', icon: '🏪' },
  { label: 'Grocery', icon: '🛒' },
  { label: 'Bakery', icon: '🥐' },
  { label: 'Restaurant', icon: '🍽️' },
  { label: 'Electronics', icon: '📱' },
  { label: 'Clothing', icon: '👕' },
  { label: 'Stationery', icon: '✏️' },
  { label: 'Other', icon: '📦' },
]

const CAT_COLOR: Record<string, string> = {
  Grocery: '#16a34a', Bakery: '#ca8a04', Restaurant: '#dc2626',
  Electronics: '#2563eb', Clothing: '#7c3aed', Stationery: '#0891b2',
  Other: '#64748b', All: '#f97316',
}
const CAT_BG: Record<string, string> = {
  Grocery: '#dcfce7', Bakery: '#fef9c3', Restaurant: '#fee2e2',
  Electronics: '#dbeafe', Clothing: '#ede9fe', Stationery: '#cffafe',
  Other: '#f1f5f9', All: '#fff7ed',
}

export default function CustomerHome() {
  const router = useRouter()
  const supabase = createClient()
  const [shops, setShops] = useState<Shop[]>([])
  const [filtered, setFiltered] = useState<Shop[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(false)
  const [radiusKm, setRadiusKm] = useState(10)
  const [greeting, setGreeting] = useState('')
  const [userName, setUserName] = useState<string | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [gpsAttempting, setGpsAttempting] = useState(false)
  // 'init' = show permission splash, 'granted' = GPS obtained, 'denied' = show error
  const [permState, setPermState] = useState<'init' | 'asking' | 'granted' | 'denied'>('init')

  async function loadSettings() {
    const { data } = await supabase.from('platform_settings').select('key,value').eq('key', 'shop_radius_km')
    if (data?.[0]) setRadiusKm(Number(data[0].value))
  }

  async function requestLocation() {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setGpsError('Location requires a secure (HTTPS) connection. Please contact support.')
      setPermState('denied')
      return
    }
    setGpsAttempting(true)
    setGpsError(null)
    setPermState('asking')
    try {
      const pos = await getCustomerGPSPosition()
      setPermState('granted')
      setGpsAttempting(false)
      loadShops(pos.coords.latitude, pos.coords.longitude)
    } catch (error) {
      setGpsAttempting(false)
      setPermState('denied')
      setGpsError(formatCustomerGPSError(error))
      setShops([])
      setFiltered([])
    }
  }

  async function loadShops(lat: number | null, lon: number | null) {
    setLoading(true)
    const { data } = await supabase.from('shops').select('*').eq('is_approved', true).eq('is_active', true).eq('is_open', true)
    if (data) {
      const activeRadius = radiusKm || 10

      // Only show shops if GPS coordinates are available
      if (lat == null || lon == null) {
        setShops([])
        setFiltered([])
        setLoading(false)
        return
      }

      const withDist = data.map((s: Shop) => ({
        ...s,
        distance: s.latitude != null && s.longitude != null
          ? getDistance(lat, lon, s.latitude, s.longitude) : null
      })).filter((s: Shop) => s.distance !== null && (s.distance!) <= activeRadius)

      if (withDist.length === 0) {
        setShops([])
        setFiltered([])
        setLoading(false)
        return
      }
      const sorted = withDist.sort((a: Shop, b: Shop) => ((a.distance ?? 99) - (b.distance ?? 99)))
      setShops(sorted)
      setFiltered(sorted)
    }
    setLoading(false)
  }

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      const name =
        profile?.full_name?.trim()?.split(' ')[0] ||
        user.user_metadata?.full_name?.trim()?.split(' ')[0] ||
        user.email?.split('@')[0] || 'there'
      setUserName(name.charAt(0).toUpperCase() + name.slice(1))
    }
    loadUser()
    loadSettings()

    // Check if permission was already granted — skip splash and load immediately
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') {
          // Already permitted — fetch GPS silently
          setPermState('asking')
          requestLocation()
        }
        // 'denied' or 'prompt' — show the splash screen
      }).catch(() => {
        // Permissions API not available — show splash so user can tap to trigger prompt
      })
    }
  }, [])

  const applyFilters = useCallback(() => {
    let result = [...shops]
    if (search) result = result.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category?.toLowerCase().includes(search.toLowerCase())
    )
    if (category !== 'All') result = result.filter(s => s.category === category)
    setFiltered(result)
  }, [shops, search, category])

  useEffect(() => { applyFilters() }, [applyFilters])

  return (
    <div className="ch-root">

      {/* ── Sticky header: greeting + search ── */}
      <div className="ch-header">
        <div className="ch-header-top">
          <div>
            <p className="ch-greeting">{greeting} 👋</p>
            <h2 className="ch-hello">
              {userName === null ? 'Hello!' : `Hello, ${userName}!`}
            </h2>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            className="ch-logout"
          >
            Logout
          </button>
        </div>

        {/* Search — only shown after location granted */}
        {permState === 'granted' && (
          <div className="ch-search-wrap">
            <span className="ch-search-icon">🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search shops or categories..."
              className="ch-search-input"
            />
            {search && (
              <button onClick={() => setSearch('')} className="ch-search-clear">✕</button>
            )}
          </div>
        )}
      </div>

      {/* ── Category strip — only shown after location granted ── */}
      {permState === 'granted' && (
        <div className="ch-cats">
        {CATEGORIES.map(cat => {
          const active = category === cat.label
          return (
            <button
              key={cat.label}
              onClick={() => setCategory(cat.label)}
              className={`ch-cat-btn${active ? ' ch-cat-active' : ''}`}
              style={active ? {
                background: CAT_BG[cat.label],
                outline: `2px solid ${CAT_COLOR[cat.label]}`,
              } : {}}
            >
              <span
                className="ch-cat-icon"
                style={{
                  background: active ? CAT_COLOR[cat.label] : '#f1f5f9',
                  color: active ? 'white' : 'inherit',
                }}
              >{cat.icon}</span>
              <span
                className="ch-cat-label"
                style={{ color: active ? CAT_COLOR[cat.label] : '#64748b', fontWeight: active ? 700 : 500 }}
              >{cat.label}</span>
            </button>
          )
        })}
      </div>
      )}

      {/* ── Section label ── */}
      <div className="ch-section-hdr">
        <span className="ch-section-title">
          {permState === 'init'
            ? 'Shops Near You'
            : permState === 'asking' || loading
            ? 'Finding shops...'
            : permState === 'denied'
            ? 'Location Required'
            : `${filtered.length} ${category !== 'All' ? category : ''} Shop${filtered.length !== 1 ? 's' : ''} Near You`}
        </span>
        {radiusKm && permState === 'granted' && !loading && <span className="ch-section-sub">Within {radiusKm} km</span>}
      </div>

      {/* ── GPS Permission Splash — shown when permission not yet asked ── */}
      {permState === 'init' && (
        <div style={{
          margin: '20px 14px',
          background: 'white',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(249,115,22,0.12)',
          border: '2px solid #fed7aa',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
            padding: '28px 24px 20px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>📍</div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#9a3412', marginBottom: 8 }}>
              Enable Location Access
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#c2410c', lineHeight: 1.5, marginBottom: 0 }}>
              We need your location to show shops near you within the <strong>{radiusKm} km</strong> delivery area.
            </p>
          </div>
          <div style={{ padding: '20px 24px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {[
                { icon: '🛒', text: 'See shops open & delivering in your area' },
                { icon: '📦', text: 'Get accurate delivery time estimates' },
                { icon: '🔒', text: 'Your location is never stored or shared' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{icon}</span>
                  <span style={{ fontSize: '0.82rem', color: '#475569' }}>{text}</span>
                </div>
              ))}
            </div>
            <button
              onClick={requestLocation}
              style={{
                width: '100%', padding: '15px',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: 'white', border: 'none', borderRadius: 14,
                fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(249,115,22,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              📍 Allow Location Access
            </button>
          </div>
        </div>
      )}

      {/* ── Asking / Loading state ── */}
      {permState === 'asking' && !shops.length && (
        <div style={{ textAlign: 'center', padding: '50px 24px' }}>
          <div style={{ width: 48, height: 48, border: '4px solid #fed7aa', borderTopColor: '#f97316', borderRadius: '50%', animation: 'ch-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>Getting your location...</p>
        </div>
      )}

      {/* ── GPS Denied / Error state ── */}
      {permState === 'denied' && (
        <div style={{ margin: '16px 14px', background: 'white', borderRadius: 16, border: '2px solid #fca5a5', overflow: 'hidden' }}>
          <div style={{ padding: '20px 20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🚫</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#dc2626', marginBottom: 6 }}>Location Access Denied</h3>
            {gpsError && <p style={{ fontSize: '0.82rem', color: '#ef4444', lineHeight: 1.5, marginBottom: 14 }}>{gpsError}</p>}
          </div>
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: '#fef2f2', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 600, marginBottom: 6 }}>📱 How to fix on Android:</p>
              <p style={{ fontSize: '0.75rem', color: '#78350f', lineHeight: 1.5 }}>Settings → Apps → Browser → Permissions → Location → Allow</p>
            </div>
            <button
              onClick={requestLocation}
              disabled={gpsAttempting}
              style={{
                width: '100%', padding: '12px',
                background: gpsAttempting ? '#94a3b8' : '#f97316',
                color: 'white', border: 'none', borderRadius: 10,
                fontWeight: 700, fontSize: '0.9rem',
                cursor: gpsAttempting ? 'not-allowed' : 'pointer',
                opacity: gpsAttempting ? 0.6 : 1
              }}
            >
              {gpsAttempting ? '⏳ Trying...' : '🔄 Try Again'}
            </button>
          </div>
        </div>
      )}

      {/* ── Shop grid ── */}
      <div className="ch-grid-wrap">

        {/* Loading skeletons */}
        {loading && (
          <div className="ch-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="ch-skeleton-card">
                <div className="skeleton ch-skeleton-img" />
                <div style={{ padding: '10px 10px 12px' }}>
                  <div className="skeleton" style={{ height: 11, marginBottom: 7, width: '72%', borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 9, width: '50%', borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state — shops loaded but none found nearby */}
        {!loading && permState === 'granted' && filtered.length === 0 && (
          <div className="ch-empty">
            <div style={{ fontSize: '2.8rem', marginBottom: 10 }}>
              {gpsError ? '📍' : '🏪'}
            </div>
            <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>No Shops Available</h3>
            <p style={{ fontSize: '0.83rem', color: '#64748b', marginBottom: 14 }}>
              No shops are open in your area right now ({radiusKm} km radius). Check back soon!
            </p>
          </div>
        )}

        {/* Shop cards */}
        {!loading && filtered.length > 0 && (
          <div className="ch-grid">
            {filtered.map(shop => (
              <div
                key={shop.id}
                onClick={() => router.push(`/customer/shop/${shop.id}`)}
                className="ch-shop-card"
              >
                {/* Image */}
                <div className="ch-card-img-wrap">
                  {shop.shop_image_url
                    ? <img src={shop.shop_image_url} alt={shop.name} className="ch-card-img" />
                    : <div className="ch-card-img-fallback">
                        <span style={{ fontSize: '2rem' }}>
                          {CATEGORIES.find(c => c.label === shop.category)?.icon || '🏪'}
                        </span>
                      </div>
                  }
                  {/* Category pill */}
                  <div
                    className="ch-card-cat-pill"
                    style={{ background: CAT_COLOR[shop.category] || '#64748b' }}
                  >{shop.category}</div>
                </div>

                {/* Info */}
                <div className="ch-card-body">
                  <div className="ch-card-name">{shop.name}</div>
                  <div className="ch-card-meta">
                    {(shop.shop_rating || shop.rating || 0) > 0 && (
                      <span className="ch-card-rating" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        ⭐ <span style={{ fontWeight: 700 }}>{(shop.shop_rating || shop.rating)}</span>
                        {shop.total_ratings && shop.total_ratings > 0 && (
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({shop.total_ratings})</span>
                        )}
                      </span>
                    )}
                    {shop.distance != null && (
                      <span className="ch-card-dist" style={{
                        color: (shop.distance as number) < 2 ? '#16a34a'
                          : (shop.distance as number) < 5 ? '#d97706' : '#dc2626'
                      }}>
                        📍 {(shop.distance as number) < 1
                          ? `${Math.round((shop.distance as number) * 1000)}m`
                          : `${(shop.distance as number).toFixed(1)} km`}
                      </span>
                    )}
                    {!shop.distance && shop.city && <span className="ch-card-city">{shop.city}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Scoped styles ── */}
      <style>{`
        .ch-root {
          background: #f8fafc;
          min-height: 100%;
          display: flex;
          flex-direction: column;
        }

        /* ---- Header ---- */
        .ch-header {
          background: linear-gradient(145deg, #f97316, #ea580c);
          padding: 16px 16px 18px;
          position: sticky;
          top: 0;
          z-index: 30;
        }
        .ch-header-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .ch-greeting { color: rgba(255,255,255,0.82); font-size: 0.78rem; margin: 0 0 2px; }
        .ch-hello { color: white; font-size: clamp(1.1rem, 5vw, 1.4rem); font-weight: 800; margin: 0; }
        .ch-logout {
          background: rgba(255,255,255,0.2);
          border: 1.5px solid rgba(255,255,255,0.4);
          border-radius: 99px; color: white;
          cursor: pointer; padding: 6px 14px;
          font-size: 0.75rem; font-weight: 700;
          white-space: nowrap; flex-shrink: 0;
          margin-top: 2px;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .ch-logout:active { background: rgba(255,255,255,0.3); }

        /* ---- Search ---- */
        .ch-search-wrap { position: relative; }
        .ch-search-icon {
          position: absolute; left: 13px; top: 50%;
          transform: translateY(-50%); font-size: 15px;
          pointer-events: none;
        }
        .ch-search-input {
          width: 100%; padding: 12px 40px 12px 40px;
          border-radius: 12px; border: none; outline: none;
          font-size: 15px; font-family: inherit;
          background: white; color: #0f172a;
          box-shadow: 0 2px 12px rgba(0,0,0,0.12);
          -webkit-appearance: none;
          touch-action: manipulation;
        }
        .ch-search-clear {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #94a3b8; font-size: 13px; padding: 4px 6px;
          touch-action: manipulation;
        }

        /* ---- Category strip ---- */
        .ch-cats {
          background: white;
          border-bottom: 1px solid #f1f5f9;
          display: flex; gap: 4px;
          padding: 10px 12px;
          overflow-x: auto; overflow-y: hidden;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
        }
        .ch-cats::-webkit-scrollbar { display: none; }

        .ch-cat-btn {
          flex-shrink: 0;
          display: flex; flex-direction: column; align-items: center;
          gap: 4px; padding: 6px 8px;
          border-radius: 10px; border: none; cursor: pointer;
          font-family: inherit; scroll-snap-align: start;
          background: transparent;
          outline: 2px solid transparent;
          outline-offset: -2px;
          transition: background 0.12s;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          min-width: 54px;
        }
        .ch-cat-btn:active { opacity: 0.8; }

        .ch-cat-icon {
          width: 36px; height: 36px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; transition: background 0.12s;
        }
        .ch-cat-label {
          font-size: 0.62rem;
          white-space: nowrap;
          transition: color 0.12s;
        }

        /* ---- Section header ---- */
        .ch-section-hdr {
          padding: 10px 14px 6px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .ch-section-title { font-weight: 700; font-size: 0.85rem; color: #0f172a; }
        .ch-section-sub { font-size: 0.7rem; color: #94a3b8; }

        /* ---- Grid ---- */
        .ch-grid-wrap { padding: 0 12px 12px; flex: 1; }
        .ch-grid {
          display: grid;
          /* Responsive: 2 cols on narrow, more on wider screens */
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        /* ---- Shop card ---- */
        .ch-shop-card {
          background: white;
          border-radius: 14px;
          border: 1.5px solid #e8edf2;
          overflow: hidden;
          cursor: pointer;
          display: flex; flex-direction: column;
          box-shadow: 0 1px 6px rgba(0,0,0,0.06);
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: transform 0.12s;
        }
        .ch-shop-card:active { transform: scale(0.97); }

        .ch-card-img-wrap {
          /* Responsive image height: 40% of card width = taller on big phones */
          aspect-ratio: 5 / 3;
          background: #f1f5f9;
          position: relative; overflow: hidden; flex-shrink: 0;
        }
        .ch-card-img { width: 100%; height: 100%; object-fit: cover; }
        .ch-card-img-fallback {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
        }
        .ch-card-cat-pill {
          position: absolute; bottom: 5px; left: 6px;
          color: white; font-size: 0.55rem; font-weight: 800;
          padding: 2px 7px; border-radius: 99px;
          text-transform: uppercase; letter-spacing: 0.3px;
        }

        .ch-card-body { padding: 8px 10px 10px; flex: 1; }
        .ch-card-name {
          font-weight: 700; font-size: 0.82rem; color: #0f172a;
          margin-bottom: 4px; line-height: 1.3;
          display: -webkit-box; overflow: hidden;
          -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .ch-card-meta { display: flex; gap: 6px; flex-wrap: wrap; }
        .ch-card-rating { font-size: 0.66rem; color: #ca8a04; font-weight: 700; }
        .ch-card-dist   { font-size: 0.66rem; font-weight: 700; }
        .ch-card-city   { font-size: 0.66rem; color: #64748b; }

        /* ---- Skeleton ---- */
        .ch-skeleton-card {
          border-radius: 14px; overflow: hidden;
          background: white; border: 1.5px solid #e2e8f0;
        }
        .ch-skeleton-img { aspect-ratio: 5/3; }

        /* ---- Empty state ---- */
        .ch-empty {
          text-align: center; padding: 40px 20px;
          background: white; border-radius: 14px;
          border: 1.5px solid #e2e8f0; margin-top: 4px;
        }
        .ch-show-all-btn {
          background: #f97316; color: white; border: none;
          border-radius: 99px; padding: 9px 22px;
          font-weight: 700; font-size: 0.85rem; cursor: pointer;
          touch-action: manipulation;
        }
        @keyframes ch-spin { to { transform: rotate(360deg); } }

        /* ── Wider phones / tablets: 3+ columns ── */
        @media (min-width: 480px) {
          .ch-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .ch-grid-wrap { padding: 0 14px 14px; }
          .ch-card-name { font-size: 0.88rem; }
        }
        @media (min-width: 640px) {
          .ch-grid { grid-template-columns: repeat(3, 1fr); gap: 14px; }
        }
        @media (min-width: 1024px) {
          .ch-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; }
          .ch-header { position: relative; }
        }
      `}</style>
    </div>
  )
}
