'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Shop {
  id: string; name: string; category: string; description: string
  shop_image_url: string; rating: number; total_orders: number
  address_line1: string; city: string; latitude: number; longitude: number
}

interface CartItem { product_id: string; name: string; price: number; quantity: number; shop_id: string; shop_name: string }

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const CATEGORIES = ['All', 'Grocery', 'Pharmacy', 'Bakery', 'Restaurant', 'Electronics', 'Clothing', 'Stationary', 'Other']

export default function CustomerHome() {
  const router = useRouter()
  const supabase = createClient()
  const [shops, setShops] = useState<Shop[]>([])
  const [filtered, setFiltered] = useState<Shop[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLon, setUserLon] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [cartCount, setCartCount] = useState(0)
  const [radiusKm, setRadiusKm] = useState(10)
  const [greeting, setGreeting] = useState('')
  const [userName, setUserName] = useState('')

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

  async function loadSettings() {
    const { data } = await supabase.from('platform_settings').select('key,value').eq('key', 'shop_radius_km')
    if (data?.[0]) setRadiusKm(Number(data[0].value))
  }

  function requestLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { setUserLat(pos.coords.latitude); setUserLon(pos.coords.longitude); loadShops(pos.coords.latitude, pos.coords.longitude) },
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
      })).filter((s: Shop & { distance: number | null }) => s.distance === null || s.distance <= radiusKm)
        .sort((a: Shop & { distance: number | null }, b: Shop & { distance: number | null }) => (a.distance ?? 99) - (b.distance ?? 99))
      setShops(withDist)
      setFiltered(withDist)
    }
    setLoading(false)
  }

  const applyFilters = useCallback(() => {
    let result = [...shops]
    if (search) result = result.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.category?.toLowerCase().includes(search.toLowerCase()))
    if (category !== 'All') result = result.filter(s => s.category === category)
    setFiltered(result)
  }, [shops, search, category])

  useEffect(() => { applyFilters() }, [applyFilters])

  return (
    <div className="fade-in">
      {/* Hero greeting */}
      <div style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(14,165,233,0.1))', borderRadius: 'var(--radius-lg)', padding: '28px', marginBottom: '28px', border: '1px solid var(--border)' }}>
        <h2 style={{ marginBottom: '6px' }}>{greeting}, {userName}! 👋</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          {userLat ? `📍 Location detected — showing shops within ${radiusKm}km` : '📍 Allow location for nearby shops'}
        </p>
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input placeholder="Search shops, products, categories..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '24px' }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)} style={{
            padding: '8px 18px', borderRadius: '99px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            background: category === cat ? 'var(--primary)' : 'var(--bg2)',
            color: category === cat ? 'white' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '0.85rem', fontFamily: 'inherit', transition: 'all 0.2s'
          }}>{cat}</button>
        ))}
      </div>

      {/* Shops grid */}
      <h3 style={{ marginBottom: '16px' }}>
        {filtered.length} {category !== 'All' ? category : ''} Shops Near You
      </h3>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div className="skeleton" style={{ height: 160 }} />
              <div style={{ padding: 16 }}>
                <div className="skeleton" style={{ height: 16, marginBottom: 8, width: '70%' }} />
                <div className="skeleton" style={{ height: 12, width: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🏪</div>
          <h3 style={{ marginBottom: 8 }}>No shops found</h3>
          <p>Try a different category or expand your search</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {filtered.map((shop: Shop & { distance?: number | null }) => (
            <div key={shop.id} className="shop-card" onClick={() => router.push(`/customer/shop/${shop.id}`)}>
              {shop.shop_image_url
                ? <img src={shop.shop_image_url} alt={shop.name} className="shop-card-img" />
                : <div className="shop-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>🏪</div>}
              <div className="shop-card-body">
                <div className="flex-between" style={{ marginBottom: '6px' }}>
                  <div className="shop-card-name">{shop.name}</div>
                  <span className="badge badge-orange">{shop.category}</span>
                </div>
                <div className="shop-card-meta">
                  {shop.rating > 0 && <span>⭐ {shop.rating}</span>}
                  {shop.total_orders > 0 && <span>📦 {shop.total_orders} orders</span>}
                  {shop.distance != null && <span>📍 {shop.distance.toFixed(1)} km</span>}
                </div>
                {shop.address_line1 && <p style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-dim)' }}>{shop.address_line1}, {shop.city}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating cart */}
      {cartCount > 0 && (
        <div className="cart-float" onClick={() => router.push('/customer/cart')}>
          🛒 <span>{cartCount} items</span> <span style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: 12 }}>View Cart →</span>
        </div>
      )}
    </div>
  )
}
