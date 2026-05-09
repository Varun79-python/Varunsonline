'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CartItem { product_id: string; name: string; price: number; quantity: number; shop_id: string; shop_name: string; image_url: string }

export default function CartPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [couponCode, setCouponCode] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponMsg, setCouponMsg] = useState('')
  const [deliveryCharge, setDeliveryCharge] = useState(30)
  const [platformFee, setPlatformFee] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    setCart(JSON.parse(localStorage.getItem('vo_cart') || '[]'))
    supabase.from('platform_settings').select('key,value').in('key', ['base_delivery_charge', 'platform_fee_percent']).then(({ data }) => {
      data?.forEach(s => {
        if (s.key === 'base_delivery_charge') setDeliveryCharge(Number(s.value))
        if (s.key === 'platform_fee_percent') setPlatformFee(Number(s.value))
      })
    })
  }, [])

  function updateQty(pid: string, delta: number) {
    setCart(prev => {
      const updated = prev.map(i => i.product_id === pid ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0)
      localStorage.setItem('vo_cart', JSON.stringify(updated))
      return updated
    })
  }

  async function applyCoupon() {
    setCouponMsg('')
    const { data } = await supabase.from('coupons').select('*').eq('code', couponCode.trim().toUpperCase()).eq('is_active', true).single()
    if (!data) { setCouponMsg('Invalid or expired coupon'); return }
    const now = new Date()
    if (data.valid_until && new Date(data.valid_until) < now) { setCouponMsg('Coupon expired'); return }
    const disc = data.discount_type === 'percent' ? Math.min((subtotal * data.discount_value) / 100, data.max_discount || Infinity) : data.discount_value
    setCouponDiscount(disc)
    setCouponMsg(`✅ ₹${disc.toFixed(0)} discount applied!`)
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const pfee = Math.round((subtotal * platformFee) / 100)
  const total = subtotal + deliveryCharge + pfee - couponDiscount

  if (cart.length === 0) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>🛒</div>
      <h2 style={{ marginBottom: 8 }}>Your cart is empty</h2>
      <p style={{ marginBottom: 24 }}>Browse shops and add items to get started</p>
      <button className="btn btn-primary" onClick={() => router.push('/customer')}>Browse Shops</button>
    </div>
  )

  return (
    <div className="fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <h2>🛒 Your Cart</h2>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{cart[0]?.shop_name}</span>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        {cart.map(item => (
          <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            {item.image_url
              ? <img src={item.image_url} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} alt={item.name} />
              : <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🛍️</div>}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.name}</div>
              <div style={{ color: 'var(--primary)', fontWeight: 700 }}>₹{item.price}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg3)', borderRadius: 8, padding: '6px 12px' }}>
              <button onClick={() => updateQty(item.product_id, -1)} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit' }}>−</button>
              <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
              <button onClick={() => updateQty(item.product_id, 1)} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit' }}>+</button>
            </div>
            <span style={{ fontWeight: 700, minWidth: 60, textAlign: 'right' }}>₹{(item.price * item.quantity).toFixed(0)}</span>
          </div>
        ))}
      </div>

      {/* Coupon */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 14 }}>🏷️ Apply Coupon</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Enter coupon code" value={couponCode} onChange={e => setCouponCode(e.target.value)} style={{ textTransform: 'uppercase' }} />
          <button className="btn btn-outline" onClick={applyCoupon}>Apply</button>
        </div>
        {couponMsg && <p style={{ marginTop: 8, fontSize: '0.85rem', color: couponMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>{couponMsg}</p>}
      </div>

      {/* Bill summary */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Bill Summary</h3>
        {[
          { label: 'Subtotal', value: subtotal },
          { label: 'Delivery Charge', value: deliveryCharge },
          { label: `Platform Fee (${platformFee}%)`, value: pfee },
          ...(couponDiscount > 0 ? [{ label: 'Coupon Discount', value: -couponDiscount }] : []),
        ].map(row => (
          <div key={row.label} className="flex-between" style={{ marginBottom: 10, fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
            <span style={{ fontWeight: 600, color: row.value < 0 ? 'var(--success)' : 'inherit' }}>
              {row.value < 0 ? '−' : ''}₹{Math.abs(row.value).toFixed(0)}
            </span>
          </div>
        ))}
        <div className="flex-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Total</span>
          <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary)' }}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      <button className="btn btn-primary btn-full btn-lg" onClick={() => router.push(`/customer/checkout?discount=${couponDiscount}&coupon=${couponCode}`)}>
        Proceed to Checkout →
      </button>
    </div>
  )
}
