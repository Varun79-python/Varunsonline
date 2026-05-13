'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
  const [loading, setLoading] = useState(true)
  const [radiusKm, setRadiusKm] = useState(10)
  const [greeting, setGreeting] = useState('')
  const [userName, setUserName] = useState<string | null>(null)

  async function loadSettings() {
    const { data } = await supabase.from('platform_settings').select('key,value').eq('key', 'shop_radius_km')
    if (data?.[0]) setRadiusKm(Number(data[0].value))
  }

  function requestLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => loadShops(pos.coords.latitude, pos.coords.longitude),
        () => loadShops(null, null),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      )
    } else loadShops(null, null)
  }

  async function loadShops(lat: number | null, lon: number | null) {
    setLoading(true)
    const { data } = await supabase.from('shops').select('*').eq('is_approved', true).eq('is_active', true).eq('is_open', true)
    if (data) {
      const activeRadius = radiusKm || 10
      const withDist = data.map((s: Shop) => ({
        ...s,
        distance: lat && lon && s.latitude && s.longitude
          ? getDistance(lat, lon, s.latitude, s.longitude) : null
      })).filter((s: Shop) => s.distance === null || (s.distance !== undefined && s.distance <= activeRadius))
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
    requestLocation()
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

        {/* Search */}
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
      </div>

      {/* ── Category strip ── */}
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

      {/* ── Section label ── */}
      <div className="ch-section-hdr">
        <span className="ch-section-title">
          {loading
            ? 'Finding shops...'
            : `${filtered.length} ${category !== 'All' ? category : ''} Shop${filtered.length !== 1 ? 's' : ''} Near You`}
        </span>
        {radiusKm && !loading && <span className="ch-section-sub">Within {radiusKm} km</span>}
      </div>

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

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="ch-empty">
            <div style={{ fontSize: '2.8rem', marginBottom: 10 }}>🏪</div>
            <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>No shops near you yet</h3>
            <p style={{ fontSize: '0.83rem', color: '#64748b', marginBottom: 14 }}>We&apos;re adding more daily!</p>
            {category !== 'All' && (
              <button onClick={() => setCategory('All')} className="ch-show-all-btn">
                Show All Shops
              </button>
            )}
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
