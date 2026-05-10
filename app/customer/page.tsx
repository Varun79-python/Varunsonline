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
interface CartItem { product_id: string; name: string; price: number; quantity: number; shop_id: string; shop_name: string }

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

const CAT_BG: Record<string, string> = {
  Grocery: '#dcfce7', Bakery: '#fef9c3', Restaurant: '#fee2e2',
  Electronics: '#dbeafe', Clothing: '#ede9fe', Stationary: '#cffafe',
  Other: '#f1f5f9', All: '#fff7ed'
}
const CAT_COLOR: Record<string, string> = {
  Grocery: '#16a34a', Bakery: '#ca8a04', Restaurant: '#dc2626',
  Electronics: '#2563eb', Clothing: '#7c3aed', Stationary: '#0891b2',
  Other: '#64748b', All: '#f97316'
}
const CAT_ICON_BG: Record<string, string> = {
  Grocery: '#86efac', Bakery: '#fde047', Restaurant: '#fca5a5',
  Electronics: '#93c5fd', Clothing: '#c4b5fd', Stationary: '#67e8f9',
  Other: '#cbd5e1', All: '#fdba74'
}

export default function CustomerHome() {
  const router = useRouter()
  const supabase = createClient()
  const [shops, setShops] = useState<Shop[]>([])
  const [filtered, setFiltered] = useState<Shop[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [cartCount, setCartCount] = useState(0)
  const [radiusKm, setRadiusKm] = useState(10)
  const [greeting, setGreeting] = useState('')
  const [userName, setUserName] = useState('')

  async function loadSettings() {
    const { data } = await supabase.from('platform_settings').select('key,value').eq('key', 'shop_radius_km')
    if (data?.[0]) setRadiusKm(Number(data[0].value))
  }

  function requestLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => loadShops(pos.coords.latitude, pos.coords.longitude),
        () => loadShops(null, null)
      )
    } else loadShops(null, null)
  }

  async function loadShops(lat: number | null, lon: number | null) {
    setLoading(true)
    const { data } = await supabase.from('shops').select('*').eq('is_approved', true).eq('is_active', true)
    if (data) {
      const withDist = data.map((s: Shop) => ({
        ...s,
        distance: lat && lon && s.latitude && s.longitude ? getDistance(lat, lon, s.latitude, s.longitude) : null
      })).sort((a: Shop, b: Shop) => ((a.distance ?? 99) - (b.distance ?? 99)))
      setShops(withDist)
      setFiltered(withDist)
    }
    setLoading(false)
  }

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    supabase.auth.getUser().then(({ data }) => {
      setUserName(data.user?.user_metadata?.full_name?.split(' ')[0] || 'there')
    })
    const cart: CartItem[] = JSON.parse(localStorage.getItem('vo_cart') || '[]')
    setCartCount(cart.reduce((s, i) => s + i.quantity, 0))
    loadSettings()
    requestLocation()
  }, [])

  const applyFilters = useCallback(() => {
    let result = [...shops]
    if (search) result = result.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.category?.toLowerCase().includes(search.toLowerCase()))
    if (category !== 'All') result = result.filter(s => s.category === category)
    setFiltered(result)
  }, [shops, search, category])

  useEffect(() => { applyFilters() }, [applyFilters])

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: cartCount > 0 ? 120 : 80 }}>

      {/* Orange hero header */}
      <div style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', padding: '20px 16px 28px' }}>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.82rem', marginBottom: 2 }}>{greeting} 👋</p>
        <h2 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800, marginBottom: 16 }}>Hello, {userName}!</h2>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '0.95rem', zIndex: 1 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search shops or categories..."
            style={{
              width: '100%', padding: '13px 16px 13px 42px',
              borderRadius: 12, border: 'none', outline: 'none',
              fontSize: '0.92rem', fontFamily: 'inherit', background: 'white',
              color: '#0f172a', boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}
          />
        </div>
      </div>

      {/* Category scroll row */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.label}
              onClick={() => setCategory(cat.label)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s',
                background: category === cat.label ? CAT_BG[cat.label] : '#f8fafc',
                outline: category === cat.label ? `2px solid ${CAT_COLOR[cat.label]}` : '2px solid transparent'
              }}
            >
              <span style={{
                width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem', background: category === cat.label ? CAT_ICON_BG[cat.label] : '#e2e8f0'
              }}>{cat.icon}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: category === cat.label ? CAT_COLOR[cat.label] : '#64748b', whiteSpace: 'nowrap' }}>
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: '16px 12px' }}>

        {/* Section header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
            {loading ? 'Loading shops...' : `${filtered.length} ${category !== 'All' ? category : ''} Shop${filtered.length !== 1 ? 's' : ''} Near You`}
          </h3>
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
              Clear ✕
            </button>
          )}
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: 'white', border: '1.5px solid #e2e8f0' }}>
                <div className="skeleton" style={{ height: 100 }} />
                <div style={{ padding: 10 }}>
                  <div className="skeleton" style={{ height: 13, marginBottom: 6, width: '75%' }} />
                  <div className="skeleton" style={{ height: 11, width: '50%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 20px', background: 'white', borderRadius: 16, border: '1.5px solid #e2e8f0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 10 }}>🏪</div>
            <h3 style={{ marginBottom: 6, fontSize: '1rem' }}>No shops found</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>Try a different category or search</p>
            {category !== 'All' && (
              <button onClick={() => setCategory('All')} style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: 99, padding: '8px 20px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                Show All Shops
              </button>
            )}
          </div>
        )}

        {/* Shops — 2-column grid, full-width cards */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {filtered.map(shop => (
              <div
                key={shop.id}
                onClick={() => router.push(`/customer/shop/${shop.id}`)}
                style={{
                  background: 'white', borderRadius: 14,
                  border: '1.5px solid #e2e8f0', overflow: 'hidden',
                  cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  transition: 'box-shadow 0.15s'
                }}
              >
                {/* Image area */}
                <div style={{ height: 100, background: '#f1f5f9', position: 'relative', overflow: 'hidden' }}>
                  {shop.shop_image_url
                    ? <img src={shop.shop_image_url} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '2.2rem' }}>
                          {CATEGORIES.find(c => c.label === shop.category)?.icon || '🏪'}
                        </span>
                      </div>
                    )
                  }
                  {/* Category badge */}
                  <div style={{
                    position: 'absolute', bottom: 6, left: 6,
                    background: CAT_COLOR[shop.category] || '#64748b',
                    color: 'white', fontSize: '0.6rem', fontWeight: 800,
                    padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.5px'
                  }}>{shop.category}</div>
                </div>

                {/* Info */}
                <div style={{ padding: '10px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: 4, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                    {shop.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '0.7rem', color: '#64748b' }}>
                    {shop.rating > 0 && <span style={{ color: '#ca8a04' }}>⭐ {shop.rating}</span>}
                    {shop.distance != null && <span>📍 {(shop.distance as number).toFixed(1)} km</span>}
                    {shop.city && !shop.distance && <span>{shop.city}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed cart bar — above bottom nav */}
      {cartCount > 0 && (
        <div
          onClick={() => router.push('/customer/cart')}
          style={{
            position: 'fixed', bottom: 56, left: 0, right: 0,
            background: '#f97316', color: 'white',
            padding: '13px 20px', cursor: 'pointer', zIndex: 89,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 -2px 12px rgba(249,115,22,0.3)'
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>🛒 {cartCount} item{cartCount !== 1 ? 's' : ''} in cart</span>
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>View Cart →</span>
        </div>
      )}
    </div>
  )
}
