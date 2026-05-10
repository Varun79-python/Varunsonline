'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'


interface Shop {
  id: string; name: string; category: string; description: string
  shop_image_url: string; rating: number; total_orders: number
  address_line1: string; city: string; latitude: number; longitude: number
  distance?: number | null
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
  { label: 'Stationary', icon: '✏️' },
  { label: 'Other', icon: '📦' },
]

const CAT_ACTIVE_BG: Record<string, string> = {
  Grocery: '#dcfce7', Bakery: '#fef9c3', Restaurant: '#fee2e2',
  Electronics: '#dbeafe', Clothing: '#ede9fe', Stationary: '#cffafe',
  Other: '#f1f5f9', All: '#fff7ed',
}
const CAT_COLOR: Record<string, string> = {
  Grocery: '#16a34a', Bakery: '#ca8a04', Restaurant: '#dc2626',
  Electronics: '#2563eb', Clothing: '#7c3aed', Stationary: '#0891b2',
  Other: '#64748b', All: '#f97316',
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
    const { data } = await supabase.from('shops').select('*').eq('is_approved', true).eq('is_active', true)
    if (data) {
      const withDist = data.map((s: Shop) => ({
        ...s,
        distance: lat && lon && s.latitude && s.longitude
          ? getDistance(lat, lon, s.latitude, s.longitude) : null
      })).sort((a: Shop, b: Shop) => ((a.distance ?? 99) - (b.distance ?? 99)))
      setShops(withDist)
      setFiltered(withDist)
    }
    setLoading(false)
  }

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Try profiles table first (most up-to-date name)
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const name =
        profile?.full_name?.trim()?.split(' ')[0] ||       // profiles table
        user.user_metadata?.full_name?.trim()?.split(' ')[0] ||  // auth metadata
        user.email?.split('@')[0] ||                         // email prefix
        'there'

      setUserName(name.charAt(0).toUpperCase() + name.slice(1)) // capitalize
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
    <div style={{ background: '#f8fafc', minHeight: '100%' }}>

      {/* ── Orange header ── */}
      <div style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', padding: '18px 16px 24px', position: 'relative' }}>
        {/* Logout button — mobile only, top-right of header */}
        <button
          onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{
            position: 'absolute', top: 14, right: 14,
            background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.4)',
            borderRadius: 99, color: 'white', cursor: 'pointer',
            padding: '5px 13px', fontSize: '0.75rem', fontWeight: 700,
            backdropFilter: 'blur(4px)', letterSpacing: '0.2px',
          }}
        >
          Logout
        </button>
        <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, margin: '0 0 2px' }}>{greeting} 👋</p>
        <h2 style={{ color: 'white', fontSize: 22, fontWeight: 800, margin: '0 0 14px', paddingRight: 80 }}>
          {userName === null ? 'Hello! 👋' : `Hello, ${userName}! 👋`}
        </h2>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search shops or categories..."
            style={{
              width: '100%', padding: '12px 14px 12px 40px',
              borderRadius: 10, border: 'none', outline: 'none',
              fontSize: '0.9rem', fontFamily: 'inherit',
              background: 'white', color: '#0f172a',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              boxSizing: 'border-box',
            } as React.CSSProperties}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: 0
            }}>✕</button>
          )}
        </div>
      </div>

      {/* ── Category strip — horizontal scroll, max 90px tall ── */}
      <div style={{
        background: 'white', borderBottom: '1px solid #f1f5f9',
        overflowX: 'auto', overflowY: 'hidden',
        display: 'flex', gap: 4, padding: '10px 12px',
        scrollSnapType: 'x mandatory', scrollbarWidth: 'none',
        maxHeight: 90, minHeight: 80,
        WebkitOverflowScrolling: 'touch',
      } as React.CSSProperties}>
        {CATEGORIES.map(cat => {
          const active = category === cat.label
          return (
            <button
              key={cat.label}
              onClick={() => setCategory(cat.label)}
              style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, padding: '6px 10px', borderRadius: 10, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', scrollSnapAlign: 'start',
                background: active ? CAT_ACTIVE_BG[cat.label] : 'transparent',
                outline: active ? `2px solid ${CAT_COLOR[cat.label]}` : '2px solid transparent',
                outlineOffset: -2, transition: 'all 0.15s', minWidth: 58,
              }}
            >
              <span style={{
                width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '1.15rem',
                background: active ? CAT_COLOR[cat.label] : '#f1f5f9',
                color: active ? 'white' : 'inherit',
              }}>{cat.icon}</span>
              <span style={{
                fontSize: '0.65rem', fontWeight: active ? 700 : 500,
                color: active ? CAT_COLOR[cat.label] : '#64748b', whiteSpace: 'nowrap',
              }}>{cat.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Section header ── */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
          {loading ? 'Finding shops...' : `${filtered.length} ${category !== 'All' ? category : ''} Shop${filtered.length !== 1 ? 's' : ''} Near You`}
        </span>
        {radiusKm && !loading && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Within {radiusKm} km</span>}
      </div>

      {/* ── Shop grid ── */}
      <div style={{ padding: '0 16px 16px' }}>

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'calc(50% - 6px) calc(50% - 6px)', gap: 12 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ borderRadius: 12, overflow: 'hidden', background: 'white', border: '1.5px solid #e2e8f0' }}>
                <div className="skeleton" style={{ height: 95 }} />
                <div style={{ padding: 10 }}>
                  <div className="skeleton" style={{ height: 12, marginBottom: 7, width: '72%' }} />
                  <div className="skeleton" style={{ height: 10, width: '48%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '48px 20px',
            background: 'white', borderRadius: 14, border: '1.5px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '2.8rem', marginBottom: 10 }}>🏪</div>
            <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>No shops near you yet</h3>
            <p style={{ fontSize: '0.83rem', color: '#64748b' }}>We&apos;re adding more daily!</p>
            {category !== 'All' && (
              <button
                onClick={() => setCategory('All')}
                style={{
                  marginTop: 14, background: '#f97316', color: 'white', border: 'none',
                  borderRadius: 99, padding: '8px 20px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer'
                }}
              >Show All Shops</button>
            )}
          </div>
        )}

        {/* 2-column shop grid — always 2 cols regardless of count */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'calc(50% - 6px) calc(50% - 6px)', gap: 12 }}>
            {filtered.map(shop => (
              <div
                key={shop.id}
                onClick={() => router.push(`/customer/shop/${shop.id}`)}
                style={{
                  background: 'white', borderRadius: 12,
                  border: '1.5px solid #e8edf2', overflow: 'hidden',
                  cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Image */}
                <div style={{ height: 95, background: '#f1f5f9', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                  {shop.shop_image_url
                    ? <img src={shop.shop_image_url} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '2rem' }}>
                          {CATEGORIES.find(c => c.label === shop.category)?.icon || '🏪'}
                        </span>
                      </div>
                  }
                  <div style={{
                    position: 'absolute', bottom: 5, left: 5,
                    background: CAT_COLOR[shop.category] || '#64748b',
                    color: 'white', fontSize: '0.58rem', fontWeight: 800,
                    padding: '2px 6px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.4px'
                  }}>{shop.category}</div>
                </div>

                {/* Info */}
                <div style={{ padding: '8px 10px', flex: 1 }}>
                  <div style={{
                    fontWeight: 700, fontSize: '0.84rem', color: '#0f172a',
                    marginBottom: 4, lineHeight: 1.3,
                    display: '-webkit-box', overflow: 'hidden',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  } as React.CSSProperties}>{shop.name}</div>
                  <div style={{ display: 'flex', gap: 6, fontSize: '0.68rem', color: '#64748b', flexWrap: 'wrap' }}>
                    {shop.rating > 0 && <span style={{ color: '#ca8a04', fontWeight: 600 }}>⭐ {shop.rating}</span>}
                    {shop.distance != null && (
                      <span style={{
                        fontWeight: 700,
                        color: (shop.distance as number) < 2 ? '#16a34a' : (shop.distance as number) < 5 ? '#d97706' : '#dc2626'
                      }}>
                        📍 {(shop.distance as number) < 1
                          ? `${Math.round((shop.distance as number) * 1000)}m away`
                          : `${(shop.distance as number).toFixed(1)} km away`}
                      </span>
                    )}
                    {!shop.distance && shop.city && <span>{shop.city}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
