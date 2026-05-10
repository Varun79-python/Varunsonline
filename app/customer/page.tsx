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

// Pharmacy removed as per business decision
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

const CATEGORY_COLORS: Record<string, string> = {
  Grocery: '#16a34a', Bakery: '#d97706', Restaurant: '#dc2626',
  Electronics: '#2563eb', Clothing: '#7c3aed', Stationary: '#0891b2', Other: '#64748b', All: '#f97316'
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
  const [locationStatus, setLocationStatus] = useState<'pending' | 'granted' | 'denied'>('pending')

  async function loadSettings() {
    const { data } = await supabase.from('platform_settings').select('key,value').eq('key', 'shop_radius_km')
    if (data?.[0]) setRadiusKm(Number(data[0].value))
  }

  function requestLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setLocationStatus('granted')
          loadShops(pos.coords.latitude, pos.coords.longitude)
        },
        () => { setLocationStatus('denied'); loadShops(null, null) }
      )
    } else { setLocationStatus('denied'); loadShops(null, null) }
  }

  async function loadShops(lat: number | null, lon: number | null) {
    setLoading(true)
    const { data } = await supabase.from('shops').select('*').eq('is_approved', true).eq('is_active', true)
    if (data) {
      const withDist = data.map((s: Shop) => ({
        ...s,
        distance: lat && lon && s.latitude && s.longitude ? getDistance(lat, lon, s.latitude, s.longitude) : null
      })).filter((s: Shop) => s.distance === null || (s.distance as number) <= radiusKm)
        .sort((a: Shop, b: Shop) => ((a.distance ?? 99) - (b.distance ?? 99)))
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
    <div className="fade-in" style={{ paddingBottom: cartCount > 0 ? 80 : 0 }}>

      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, #f97316, #ea580c)',
        borderRadius: 'var(--radius-lg)', padding: '24px 20px',
        marginBottom: 20, color: 'white', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', right: 30, bottom: -30, width: 80, height: 80, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: 4, color: 'rgba(255,255,255,0.9)' }}>{greeting} 👋</p>
          <h2 style={{ color: 'white', marginBottom: 4, fontSize: '1.4rem' }}>Hello, {userName}!</h2>
          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', marginBottom: 16 }}>
            {locationStatus === 'granted' ? `📍 Showing shops within ${radiusKm} km` : locationStatus === 'denied' ? '📍 Location not available' : '📡 Detecting location...'}
          </p>
          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem' }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search shops or categories..."
              style={{
                width: '100%', padding: '12px 16px 12px 42px',
                borderRadius: 99, border: 'none', outline: 'none',
                fontSize: '0.92rem', fontFamily: 'inherit',
                background: 'white', color: '#0f172a', boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
              }}
            />
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 20, scrollbarWidth: 'none' }}>
        {CATEGORIES.map(cat => (
          <button key={cat.label} onClick={() => setCategory(cat.label)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 99, border: `2px solid ${category === cat.label ? CATEGORY_COLORS[cat.label] : 'var(--border)'}`,
            cursor: 'pointer', whiteSpace: 'nowrap',
            background: category === cat.label ? CATEGORY_COLORS[cat.label] : 'white',
            color: category === cat.label ? 'white' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '0.82rem', fontFamily: 'inherit',
            transition: 'all 0.15s', flexShrink: 0
          }}>
            <span>{cat.icon}</span> {cat.label}
          </button>
        ))}
      </div>

      {/* Section header */}
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: '1rem' }}>
          {filtered.length} {category !== 'All' ? category : ''} {filtered.length === 1 ? 'Shop' : 'Shops'} Near You
        </h3>
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            Clear ✕
          </button>
        )}
      </div>

      {/* Shops grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1.5px solid var(--border)', background: 'white' }}>
              <div className="skeleton" style={{ height: 120 }} />
              <div style={{ padding: 12 }}>
                <div className="skeleton" style={{ height: 14, marginBottom: 8, width: '70%' }} />
                <div className="skeleton" style={{ height: 11, width: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏪</div>
          <h3 style={{ marginBottom: 8 }}>No shops found</h3>
          <p>Try a different category or search term</p>
          {category !== 'All' && (
            <button onClick={() => setCategory('All')} className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>Show All Shops</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
          {filtered.map(shop => (
            <div
              key={shop.id}
              onClick={() => router.push(`/customer/shop/${shop.id}`)}
              style={{
                background: 'white', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)',
                overflow: 'hidden', cursor: 'pointer', transition: 'all 0.18s',
                boxShadow: '0 1px 6px rgba(0,0,0,0.06)'
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 6px rgba(0,0,0,0.06)' }}
            >
              {/* Shop image */}
              <div style={{ height: 110, background: 'var(--bg3)', position: 'relative', overflow: 'hidden' }}>
                {shop.shop_image_url
                  ? <img src={shop.shop_image_url} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>🏪</div>
                }
                <div style={{
                  position: 'absolute', top: 8, left: 8,
                  background: CATEGORY_COLORS[shop.category] || '#64748b',
                  color: 'white', fontSize: '0.65rem', fontWeight: 700,
                  padding: '2px 8px', borderRadius: 99
                }}>{shop.category}</div>
              </div>
              {/* Info */}
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4, color: 'var(--text)', lineHeight: 1.3 }}>{shop.name}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {shop.rating > 0 && <span>⭐ {shop.rating}</span>}
                  {shop.distance != null && <span>📍 {shop.distance.toFixed(1)} km</span>}
                  {shop.city && <span>{shop.city}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fixed cart bar at bottom — no bouncing, no page shift */}
      {cartCount > 0 && (
        <div
          onClick={() => router.push('/customer/cart')}
          style={{
            position: 'fixed', bottom: 64, left: 0, right: 0,
            background: 'var(--primary)', color: 'white',
            padding: '14px 20px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            zIndex: 90, boxShadow: '0 -4px 20px rgba(249,115,22,0.25)'
          }}
        >
          <span style={{ fontWeight: 700 }}>🛒 {cartCount} item{cartCount !== 1 ? 's' : ''} in cart</span>
          <span style={{ fontWeight: 700 }}>View Cart →</span>
        </div>
      )}
    </div>
  )
}
