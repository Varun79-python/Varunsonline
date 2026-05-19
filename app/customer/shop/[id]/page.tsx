'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCustomerGPSPosition } from '@/lib/customerGps'

interface Product {
  id: string; name: string; description: string; price: number; mrp: number
  discount_percent: number; image_url: string; unit: string; stock_quantity: number; category: string
  rating?: number
  total_ratings?: number
}
interface Shop {
  id: string; name: string; category: string; shop_image_url: string
  description: string; rating: number; address_line1: string; city: string; is_open: boolean
  distance?: number | null
  latitude?: number | null
  longitude?: number | null
  shop_rating?: number | null
  delivery_rating?: number | null
  total_ratings?: number | null
}
interface CartItem { product_id: string; name: string; price: number; quantity: number; shop_id: string; shop_name: string; image_url: string }

// SVG Icons
const SearchIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const HeartIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
const HeartFilledIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
const StarIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
const LocationIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
const ClockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const PlusIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const MinusIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
const CartIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
const BackIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
const FireIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.866 0-7-3.134-7-7 0-2.3 1.3-4.3 2.8-5.6.5-.4 1.1-.8 1.7-1.2-.5 1.6-.2 3.3.7 4.6.9 1.4 2.4 2.3 4.8 2.3.6 0 1.2-.1 1.7-.2-1.5-1.3-2.5-3.2-2.5-5.3 0-2.1 1-4 2.6-5.2.4-.3.9-.6 1.3-.9-.3.5-.5 1-.5 1.6 0 1.8 1.3 3.3 3 3.9 1.7.6 2.8 2.1 2.8 4 0 3.9-3.1 7.2-7.1 7.2z"/></svg>
const SparkleIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 8.5L22 9.5L16.5 14.5L18 22L12 18L6 22L7.5 14.5L2 9.5L9.5 8.5L12 2Z"/></svg>
const PopularIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
const HistoryIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function ShopPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [shop, setShop] = useState<Shop | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [filtered, setFiltered] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [isFavorite, setIsFavorite] = useState(false)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLon, setUserLon] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCart(JSON.parse(localStorage.getItem('vo_cart') || '[]'))
    
    getCustomerGPSPosition()
      .then(pos => {
        setUserLat(pos.coords.latitude)
        setUserLon(pos.coords.longitude)
      })
      .catch(error => console.warn('Customer shop GPS unavailable:', error))
    
    async function load() {
      const [{ data: shopData }, { data: prodData }] = await Promise.all([
        supabase.from('shops').select('*').eq('id', id).single(),
        supabase.from('products').select('*').eq('shop_id', id).eq('is_available', true).order('created_at', { ascending: false })
      ])
      setShop(shopData)
      setProducts(prodData || [])
      setFiltered(prodData || [])
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    let result = search ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase())) : products
    if (activeCategory !== 'All') result = result.filter(p => p.category === activeCategory)
    setFiltered(result)
  }, [search, activeCategory, products])

  function getQty(pid: string) { return cart.find(c => c.product_id === pid)?.quantity || 0 }

  function updateCart(product: Product, delta: number) {
    if (!shop) return
    if (!shop.is_open) { alert('This shop is currently closed. Please check back later.'); return }
    setCart(prev => {
      let updated = [...prev]
      if (updated.length > 0 && updated[0].shop_id !== id) {
        if (!confirm('Your cart has items from another shop. Clear it?')) return prev
        updated = []
      }
      const idx = updated.findIndex(c => c.product_id === product.id)
      if (idx >= 0) {
        updated[idx].quantity += delta
        if (updated[idx].quantity <= 0) updated.splice(idx, 1)
      } else if (delta > 0) {
        updated.push({ product_id: product.id, name: product.name, price: product.price, quantity: 1, shop_id: id as string, shop_name: shop.name, image_url: product.image_url })
      }
      localStorage.setItem('vo_cart', JSON.stringify(updated))
      return updated
    })
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))] as string[]

  // Calculate distance if we have coordinates
  const distance = shop && userLat != null && userLon != null && shop.latitude != null && shop.longitude != null
    ? getDistance(userLat, userLon, shop.latitude, shop.longitude)
    : null
  
  // Estimate delivery time (roughly 1 min per 200m, min 15 mins)
  const deliveryTime = distance ? Math.max(15, Math.round(distance * 5)) : 20

  // Section products
  const bestSellers = products.slice(0, 6)
  const recommended = products.filter(p => (p.rating || 0) > 0).slice(0, 6)
  const popular = products.sort((a, b) => (b.stock_quantity || 0) - (a.stock_quantity || 0)).slice(0, 6)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 50, height: 50, border: '4px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
  
  if (!shop) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>Shop not found</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: cartCount > 0 ? 100 : 20 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        .shimmer { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
        .fade-in { animation: fadeInUp 0.4s ease forwards; }
        .sticky-header { position: sticky; top: 0; z-index: 100; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Premium Sticky Header with Glassmorphism */}
      <div className="sticky-header">
        <div style={{ 
          background: shop.shop_image_url 
            ? `linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%), url(${shop.shop_image_url}) center/cover` 
            : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          height: 220,
          position: 'relative',
        }}>
          {/* Back Button */}
          <button 
            onClick={() => router.back()}
            style={{
              position: 'absolute', top: 16, left: 16,
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white'
            }}
          >
            <BackIcon />
          </button>

          {/* Favorite Button */}
          <button 
            onClick={() => setIsFavorite(!isFavorite)}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isFavorite ? '#ef4444' : 'white',
              transition: 'transform 0.2s',
              transform: isFavorite ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            {isFavorite ? <HeartFilledIcon /> : <HeartIcon />}
          </button>

          {/* Shop Info Overlay */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
            <h1 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800, marginBottom: 8 }}>{shop.name}</h1>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {/* Shop Rating (Average from all customers) */}
              {(shop.shop_rating || 0) > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 20, backdropFilter: 'blur(10px)' }}>
                  <StarIcon />
                  <span style={{ color: 'white', fontWeight: 700, fontSize: '0.85rem' }}>{shop.shop_rating}</span>
                  {shop.total_ratings && shop.total_ratings > 0 && (
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>({shop.total_ratings})</span>
                  )}
                </span>
              )}
              
              {/* Category */}
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                🏷️ {shop.category}
              </span>

              {/* Distance */}
              {distance !== null && (
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <LocationIcon />
                  {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)} km`}
                </span>
              )}

              {/* Delivery Time */}
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ClockIcon />
                {deliveryTime} min
              </span>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div style={{ 
          background: 'white', 
          padding: '12px 20px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          borderRadius: '0 0 20px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ 
              width: 10, height: 10, borderRadius: '50%', 
              background: shop.is_open ? '#16a34a' : '#dc2626',
              boxShadow: shop.is_open ? '0 0 8px rgba(22,163,74,0.5)' : 'none'
            }} />
            <span style={{ fontWeight: 600, color: shop.is_open ? '#16a34a' : '#dc2626' }}>
              {shop.is_open ? 'Open' : 'Closed'}
            </span>
          </div>
          {shop.description && (
            <span style={{ color: '#64748b', fontSize: '0.8rem', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {shop.description}
            </span>
          )}
        </div>
      </div>

      {/* Closed Banner */}
      {!shop.is_open && (
        <div style={{ 
          margin: '16px 16px 0', 
          background: '#fef2f2', 
          border: '1px solid #fecaca', 
          borderRadius: 14, 
          padding: 14, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12 
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.3rem' }}>🔴</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '0.95rem' }}>Shop is Currently Closed</div>
            <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>Browse products but cannot place order</div>
          </div>
        </div>
      )}

      {/* Premium Search Bar */}
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ 
          position: 'relative',
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          border: '1px solid #f1f5f9',
        }}>
          <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 1 }}>
            <SearchIcon />
          </div>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products, brands..."
            style={{
              width: '100%',
              padding: '14px 44px 14px 46px',
              borderRadius: 16,
              border: 'none',
              outline: 'none',
              fontSize: '0.95rem',
              background: 'transparent',
              color: '#0f172a',
            }}
          />
          {search && (
            <button 
              onClick={() => { setSearch(''); searchRef.current?.focus() }}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                width: 24, height: 24, borderRadius: '50%',
                background: '#f1f5f9', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#64748b', fontSize: 12
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Premium Category Chips */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ 
          display: 'flex', 
          gap: 10, 
          overflowX: 'auto', 
          paddingBottom: 4,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }} className="hide-scrollbar">
          {categories.map(cat => {
            const active = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  flexShrink: 0,
                  padding: '10px 18px',
                  borderRadius: 99,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: active ? 700 : 600,
                  fontSize: '0.85rem',
                  background: active 
                    ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' 
                    : 'white',
                  color: active ? 'white' : '#64748b',
                  boxShadow: active 
                    ? '0 4px 16px rgba(249,115,22,0.35)' 
                    : '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat === 'All' && '🏪 '}
                {cat === 'Grocery' && '🛒 '}
                {cat === 'Bakery' && '🥐 '}
                {cat === 'Restaurant' && '🍽️ '}
                {cat === 'Electronics' && '📱 '}
                {cat === 'Clothing' && '👕 '}
                {cat === 'Stationery' && '✏️ '}
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Search Results Indicator */}
      {search && (
        <div style={{ padding: '0 16px 12px' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Showing {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &quot;{search}&quot;
          </span>
        </div>
      )}

      {/* Products Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ fontSize: '2.5rem' }}>🔍</span>
          </div>
          <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: 8 }}>No products found</h3>
          <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Try searching for something else</p>
        </div>
      ) : (
        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {filtered.map((p, idx) => {
            const qty = getQty(p.id)
            const discPct = p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0
            return (
              <div 
                key={p.id}
                style={{
                  background: 'white',
                  borderRadius: 16,
                  border: '1px solid #f1f5f9',
                  overflow: 'hidden',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                  animation: 'fadeInUp 0.4s ease backwards',
                  animationDelay: `${idx * 0.03}s`,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {/* Product Image */}
                <div style={{ height: 120, background: '#f8fafc', position: 'relative' }}>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>🛍️</div>
                  )}
                  
                  {/* Discount Badge */}
                  {discPct > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                      color: 'white',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 8,
                      boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
                    }}>
                      {discPct}% OFF
                    </div>
                  )}

                  {/* Out of Stock Overlay */}
                  {(p.stock_quantity || 0) === 0 && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ background: '#dc2626', color: 'white', padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }}>
                        Out of Stock
                      </span>
                    </div>
                  )}
                </div>

                {/* Product Body */}
                <div style={{ padding: '12px' }}>
                  <div style={{ 
                    fontWeight: 600, 
                    fontSize: '0.9rem', 
                    color: '#0f172a',
                    marginBottom: 4,
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    overflow: 'hidden',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {p.name}
                  </div>

                  {/* Weight/Unit */}
                  {p.unit && (
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>
                      {p.unit}
                    </div>
                  )}

                  {/* Rating */}
                  {(p.rating || 0) > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                      <span style={{ color: '#f59e0b', fontSize: '0.9rem' }}>★</span>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>{p.rating}</span>
                      {p.total_ratings && p.total_ratings > 0 && (
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({p.total_ratings})</span>
                      )}
                    </div>
                  )}

                  {/* Price */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#f97316' }}>₹{p.price}</span>
                    {p.mrp > p.price && (
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', textDecoration: 'line-through' }}>₹{p.mrp}</span>
                    )}
                  </div>

                  {/* Add to Cart / Quantity Controls */}
                  {(p.stock_quantity || 0) === 0 ? (
                    <div style={{ textAlign: 'center', padding: '8px', borderRadius: 10, background: '#f1f5f9', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                      Unavailable
                    </div>
                  ) : !shop.is_open ? (
                    <div style={{ textAlign: 'center', padding: '8px', borderRadius: 10, background: '#fef3c7', color: '#d97706', fontSize: '0.8rem', fontWeight: 600 }}>
                      Closed
                    </div>
                  ) : qty === 0 ? (
                    <button 
                      onClick={() => updateCart(p, 1)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: 10,
                        border: '1.5px solid #f97316',
                        background: 'white',
                        color: '#f97316',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseDown={(e) => e.currentTarget.style.background = '#fff7ed'}
                      onMouseUp={(e) => e.currentTarget.style.background = 'white'}
                    >
                      Add to Cart
                    </button>
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                      borderRadius: 10,
                      padding: '4px',
                    }}>
                      <button 
                        onClick={() => updateCart(p, -1)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: 'none',
                          background: 'white',
                          color: '#f97316',
                          fontWeight: 700,
                          fontSize: '1.2rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        −
                      </button>
                      <span style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>{qty}</span>
                      <button 
                        onClick={() => updateCart(p, 1)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: 'none',
                          background: 'white',
                          color: '#f97316',
                          fontWeight: 700,
                          fontSize: '1.2rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}