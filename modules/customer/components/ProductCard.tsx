'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

/* ── Inline SVG Icons ─────────────────────────────────────────────── */
const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const MinusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
)

/* ── Types ────────────────────────────────────────────────────────── */
export interface ProductCardData {
  id: string
  name: string
  description?: string | null
  price: number
  mrp: number
  discount_percent?: number | null
  image_url?: string | null
  unit?: string | null
  stock_quantity: number
  rating?: number | null
  total_ratings?: number | null
  category?: string | null
  shop: {
    id: string
    name: string
    shop_image_url?: string | null
    city?: string | null
    is_open?: boolean | null
    subscription_end_date?: string | null
  }
}

/* ── Props ────────────────────────────────────────────────────────── */
interface ProductCardProps {
  product: ProductCardData
}

/* ── Cart helpers (mirrors shop/[id]/page.tsx) ────────────────────── */
interface CartItem {
  product_id: string
  name: string
  price: number
  quantity: number
  shop_id: string
  shop_name: string
  image_url: string
}

function getCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('vo_cart') || '[]')
  } catch {
    return []
  }
}

function saveCart(cart: CartItem[]) {
  localStorage.setItem('vo_cart', JSON.stringify(cart))
}

/* ── Component ────────────────────────────────────────────────────── */
export default function ProductCard({ product }: ProductCardProps) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    setCart(getCart())
  }, [])

  const qty = cart.find(c => c.product_id === product.id)?.quantity || 0

  const updateCart = useCallback(
    (delta: number) => {
      // If shop is closed, block add
      if (product.shop.is_open === false && delta > 0) {
        alert(`"${product.shop.name}" is currently closed.`)
        return
      }

      // If shop's subscription has expired, block add
      if (product.shop.subscription_end_date && new Date(product.shop.subscription_end_date) < new Date() && delta > 0) {
        alert(`"${product.shop.name}" is temporarily unavailable.`)
        return
      }

      setCart(prev => {
        let updated = [...prev]

        // Cart must be from the same shop — ask to clear if mixing
        if (updated.length > 0 && updated[0].shop_id !== product.shop.id) {
          if (delta <= 0) return prev // removing from wrong-shop cart = no-op
          if (!confirm('Your cart has items from another shop. Clear it and start fresh?')) return prev
          updated = []
        }

        const idx = updated.findIndex(c => c.product_id === product.id)
        if (idx >= 0) {
          updated[idx].quantity += delta
          if (updated[idx].quantity <= 0) updated.splice(idx, 1)
        } else if (delta > 0) {
          if (product.stock_quantity <= 0) {
            alert('This product is out of stock.')
            return prev
          }
          updated.push({
            product_id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            shop_id: product.shop.id,
            shop_name: product.shop.name,
            image_url: product.image_url || '',
          })
        }

        saveCart(updated)
        return updated
      })
    },
    [product]
  )

  // Discount badge
  const discount =
    product.discount_percent && product.discount_percent > 0
      ? product.discount_percent
      : product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0

  const unitLabel = product.unit || 'piece'

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        border: '1px solid #f1f5f9',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.15s, box-shadow 0.15s',
        cursor: 'pointer',
        animation: 'fadeInUp 0.35s ease forwards',
      }}
      onClick={() => router.push(`/customer/shop/${product.shop.id}`)}
    >
      <style>{`
        .pcard:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.1); }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
      `}</style>

      {/* ── Image ─────────────────────────────────────────────── */}
      <div style={{ position: 'relative', paddingTop: '75%', background: '#f8fafc', overflow: 'hidden' }}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem', color: '#cbd5e1',
            }}
          >
            🛒
          </div>
        )}

        {/* Discount badge */}
        {discount > 0 && (
          <span
            style={{
              position: 'absolute', top: 8, left: 8,
              background: 'linear-gradient(135deg, #dc2626, #f97316)',
              color: 'white', fontSize: '0.7rem', fontWeight: 700,
              padding: '2px 8px', borderRadius: 20,
              boxShadow: '0 2px 6px rgba(220,38,38,0.3)',
            }}
          >
            {discount}% OFF
          </span>
        )}

        {/* Stock badge */}
        {product.stock_quantity <= 0 && (
          <span
            style={{
              position: 'absolute', top: 8, right: 8,
              background: '#fef2f2', color: '#dc2626',
              fontSize: '0.65rem', fontWeight: 700,
              padding: '2px 8px', borderRadius: 20,
            }}
          >
            Out of Stock
          </span>
        )}
      </div>

      {/* ── Info ──────────────────────────────────────────────── */}
      <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Shop name */}
        <span style={{ fontSize: '0.7rem', color: '#f97316', fontWeight: 600 }}>
          {product.shop.name}
        </span>

        {/* Product name */}
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {product.name}
        </div>

        {/* Unit */}
        {product.category && (
          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{product.category}</span>
        )}

        {/* Rating */}
        {(product.rating ?? 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ color: '#f59e0b' }}><StarIcon /></span>
            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#0f172a' }}>
              {Number(product.rating).toFixed(1)}
            </span>
            {product.total_ratings != null && product.total_ratings > 0 && (
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>({product.total_ratings})</span>
            )}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Price + Add to Cart */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 6 }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>₹{product.price}</span>
            {product.mrp > product.price && (
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textDecoration: 'line-through', marginLeft: 6 }}>
                ₹{product.mrp}
              </span>
            )}
            <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>/{unitLabel}</div>
          </div>

          {/* Add/Remove buttons */}
          {qty > 0 ? (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 0,
                background: '#f97316', borderRadius: 10, overflow: 'hidden',
                height: 34, flexShrink: 0,
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => updateCart(-1)}
                style={{
                  width: 34, height: 34, border: 'none', background: 'rgba(255,255,255,0.15)',
                  color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', fontWeight: 700, padding: 0,
                }}
              >
                <MinusIcon />
              </button>
              <span style={{ width: 34, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', color: 'white' }}>
                {qty}
              </span>
              <button
                onClick={() => updateCart(1)}
                style={{
                  width: 34, height: 34, border: 'none', background: 'rgba(255,255,255,0.15)',
                  color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', fontWeight: 700, padding: 0,
                }}
              >
                <PlusIcon />
              </button>
            </div>
          ) : (
            <button
              disabled={product.stock_quantity <= 0}
              onClick={e => { e.stopPropagation(); updateCart(1) }}
              style={{
                width: 34, height: 34, borderRadius: 10, border: '1.5px solid #f97316',
                background: product.stock_quantity <= 0 ? '#f1f5f9' : 'white',
                color: product.stock_quantity <= 0 ? '#94a3b8' : '#f97316',
                cursor: product.stock_quantity <= 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, padding: 0,
                transition: 'all 0.15s',
              }}
            >
              <PlusIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
