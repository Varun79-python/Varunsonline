'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Product {
  id: string; name: string; description: string; price: number; mrp: number
  discount_percent: number; image_url: string; unit: string; stock_quantity: number; category: string
}
interface Shop {
  id: string; name: string; category: string; shop_image_url: string
  description: string; rating: number; address_line1: string; city: string; is_open: boolean
}
interface CartItem { product_id: string; name: string; price: number; quantity: number; shop_id: string; shop_name: string; image_url: string }

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

  useEffect(() => {
    setCart(JSON.parse(localStorage.getItem('vo_cart') || '[]'))
    async function load() {
      const [{ data: shopData }, { data: prodData }] = await Promise.all([
        supabase.from('shops').select('*').eq('id', id).single(),
        supabase.from('products').select('*').eq('shop_id', id).eq('is_available', true).order('category')
      ])
      setShop(shopData)
      setProducts(prodData || [])
      setFiltered(prodData || [])
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    setFiltered(search ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) : products)
  }, [search, products])

  function getQty(pid: string) { return cart.find(c => c.product_id === pid)?.quantity || 0 }

  function updateCart(product: Product, delta: number) {
    if (!shop) return
    setCart(prev => {
      let updated = [...prev]
      // Block mixing shops
      if (updated.length > 0 && updated[0].shop_id !== id) {
        if (!confirm('Your cart has items from another shop. Clear it?')) return prev
        updated = []
      }
      const idx = updated.findIndex(c => c.product_id === product.id)
      if (idx >= 0) {
        updated[idx].quantity += delta
        if (updated[idx].quantity <= 0) updated.splice(idx, 1)
      } else if (delta > 0) {
        updated.push({ product_id: product.id, name: product.name, price: product.price, quantity: 1, shop_id: id, shop_name: shop.name, image_url: product.image_url })
      }
      localStorage.setItem('vo_cart', JSON.stringify(updated))
      return updated
    })
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const categories = [...new Set(filtered.map(p => p.category).filter(Boolean))]

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} /></div>
  if (!shop) return <div style={{ padding: 40, textAlign: 'center' }}>Shop not found</div>

  return (
    <div className="fade-in">
      {/* Shop Header */}
      <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 24, border: '1px solid var(--border)' }}>
        {shop.shop_image_url
          ? <img src={shop.shop_image_url} alt={shop.name} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
          : <div style={{ height: 160, background: 'linear-gradient(135deg, var(--bg2), var(--bg3))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>🏪</div>}
        <div style={{ padding: '20px 24px', background: 'var(--card)' }}>
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <h2>{shop.name}</h2>
            <span className={`badge ${shop.is_open ? 'badge-green' : 'badge-red'}`}>{shop.is_open ? '● Open' : '● Closed'}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span>🏷️ {shop.category}</span>
            {shop.rating > 0 && <span>⭐ {shop.rating}</span>}
            <span>📍 {shop.address_line1}, {shop.city}</span>
          </div>
          {shop.description && <p style={{ marginTop: 8, fontSize: '0.88rem' }}>{shop.description}</p>}
        </div>
      </div>

      {/* Search */}
      <div className="search-bar" style={{ marginBottom: 20 }}>
        <span className="search-icon">🔍</span>
        <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Products by category */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>📦</div>
          <h3>No products available</h3>
        </div>
      ) : (
        (categories.length > 0 ? categories : ['']).map(cat => {
          const catProds = cat ? filtered.filter(p => p.category === cat) : filtered
          return (
            <div key={cat} style={{ marginBottom: 28 }}>
              {cat && <h3 style={{ marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>{cat}</h3>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                {catProds.map(p => {
                  const qty = getQty(p.id)
                  const discPct = p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0
                  return (
                    <div key={p.id} className="product-card">
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} className="product-card-img" />
                        : <div className="product-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>🛍️</div>}
                      <div className="product-card-body">
                        {discPct > 0 && <span className="badge badge-green" style={{ marginBottom: 6 }}>{discPct}% OFF</span>}
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{p.name}</div>
                        {p.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 8 }}>{p.description}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                          <div>
                            <span className="product-price">₹{p.price}</span>
                            {p.mrp > p.price && <span className="product-mrp">₹{p.mrp}</span>}
                          </div>
                          {p.stock_quantity === 0 ? (
                            <span className="badge badge-red">Out of stock</span>
                          ) : qty === 0 ? (
                            <button className="btn btn-primary btn-sm" onClick={() => updateCart(p, 1)}>Add</button>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--primary)', borderRadius: 8, padding: '4px 10px' }}>
                              <button onClick={() => updateCart(p, -1)} style={{ background: 'none', border: 'none', color: 'white', font: 'inherit', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>−</button>
                              <span style={{ color: 'white', fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{qty}</span>
                              <button onClick={() => updateCart(p, 1)} style={{ background: 'none', border: 'none', color: 'white', font: 'inherit', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {/* Floating cart */}
      {cartCount > 0 && (
        <div className="cart-float" onClick={() => router.push('/customer/cart')}>
          🛒 {cartCount} items
          <span style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: 12 }}>₹{cartTotal.toFixed(0)} • Checkout →</span>
        </div>
      )}
    </div>
  )
}
