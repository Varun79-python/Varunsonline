'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CartItem { product_id: string; name: string; price: number; quantity: number; shop_id: string; shop_name: string; image_url: string }

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const MinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)
const CartEmptyIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
)

export default function CartPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [couponCode, setCouponCode] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponMsg, setCouponMsg] = useState('')
  const [deliveryCharge, setDeliveryCharge] = useState(30)
  const [platformFee, setPlatformFee] = useState(0)
  const [removingId, setRemovingId] = useState<string | null>(null)
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

  function removeItem(pid: string) {
    setRemovingId(pid)
    setTimeout(() => {
      setCart(prev => {
        const updated = prev.filter(i => i.product_id !== pid)
        localStorage.setItem('vo_cart', JSON.stringify(updated))
        return updated
      })
    }, 200)
  }

  async function applyCoupon() {
    setCouponMsg('')
    const { data } = await supabase.from('coupons').select('*').eq('code', couponCode.trim().toUpperCase()).eq('is_active', true).single()
    if (!data) { setCouponMsg('Invalid or expired coupon'); return }
    const now = new Date()
    if (data.valid_until && new Date(data.valid_until) < now) { setCouponMsg('Coupon expired'); return }
    const disc = data.discount_type === 'percent' ? Math.min((subtotal * data.discount_value) / 100, data.max_discount || Infinity) : data.discount_value
    setCouponDiscount(disc)
    setCouponMsg(`🎉 ₹${disc.toFixed(0)} discount applied!`)
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const pfee = Math.round((subtotal * platformFee) / 100)
  const total = subtotal + deliveryCharge + pfee - couponDiscount

  if (cart.length === 0) return (
    <div style={{ textAlign: 'center', padding: '80px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 100, height: 100, borderRadius: 30, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <CartEmptyIcon />
      </div>
      <h2 style={{ marginBottom: 8, fontSize: '1.25rem', color: '#0f172a' }}>Your cart is empty</h2>
      <p style={{ marginBottom: 24, color: '#64748b', fontSize: '0.9rem' }}>Add items from shops to get started</p>
      <button className="btn btn-primary" onClick={() => router.push('/customer')}
        style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', padding: '12px 28px', borderRadius: 12, fontWeight: 700, boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}>
        Browse Shops
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: '0 16px 140px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ padding: '20px 0 16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🛒</span>
          Your Cart
        </h2>
        {cart[0]?.shop_name && (
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 4 }}>From: <span style={{ fontWeight: 600, color: '#f97316' }}>{cart[0].shop_name}</span></p>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: 16 }}>
        {cart.map((item, idx) => (
          <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 14px', borderBottom: idx < cart.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'all 0.2s ease', opacity: removingId === item.product_id ? 0 : 1 }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, background: '#f8fafc', overflow: 'hidden', flexShrink: 0 }}>
              {item.image_url ? <img src={item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={item.name} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🛍️</div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', marginBottom: 4 }}>{item.name}</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f97316' }}>₹{item.price}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#fff7ed', borderRadius: 10, padding: '4px' }}>
              <button onClick={() => item.quantity === 1 ? removeItem(item.product_id) : updateQty(item.product_id, -1)} style={{ background: item.quantity === 1 ? '#fef2f2' : 'white', border: 'none', color: item.quantity === 1 ? '#dc2626' : '#f97316', cursor: 'pointer', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                {item.quantity === 1 ? <TrashIcon /> : <MinusIcon />}
              </button>
              <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center', fontSize: '0.9rem', color: '#0f172a' }}>{item.quantity}</span>
              <button onClick={() => updateQty(item.product_id, 1)} style={{ background: '#f97316', border: 'none', color: 'white', cursor: 'pointer', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PlusIcon />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: '1.1rem' }}>🎟️</span>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Apply Coupon</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input placeholder="Enter code" value={couponCode} onChange={e => setCouponCode(e.target.value)} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', transition: 'all 0.2s', textTransform: 'uppercase' }} onFocus={(e) => e.target.style.borderColor = '#f97316'} onBlur={(e) => e.target.style.borderColor = '#e2e8f0'} />
          <button onClick={applyCoupon} style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: 10, padding: '0 20px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>Apply</button>
        </div>
        {couponMsg && <p style={{ marginTop: 10, fontSize: '0.8rem', color: couponMsg.startsWith('🎉') ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{couponMsg}</p>}
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: '1.1rem' }}>📋</span>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Bill Summary</span>
        </div>
        {[{ label: 'Subtotal', value: subtotal }, { label: 'Delivery Fee', value: deliveryCharge }, { label: `Platform Fee (${platformFee}%)`, value: pfee }, ...(couponDiscount > 0 ? [{ label: 'Coupon Discount', value: -couponDiscount }] : [])].map((row) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: '0.9rem' }}>
            <span style={{ color: '#64748b' }}>{row.label}</span>
            <span style={{ fontWeight: 600, color: row.value < 0 ? '#16a34a' : '#0f172a' }}>{row.value < 0 ? '−' : ''}₹{Math.abs(row.value).toFixed(0)}</span>
          </div>
        ))}
        <div style={{ borderTop: '1.5px dashed #e2e8f0', paddingTop: 16, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>Total</span>
          <span style={{ fontWeight: 800, fontSize: '1.3rem', color: '#f97316' }}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      <button onClick={() => router.push(`/customer/checkout?discount=${couponDiscount}&coupon=${couponCode}`)} style={{ position: 'fixed', bottom: 84, left: 16, right: 16, background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: 'white', border: 'none', borderRadius: 14, padding: '16px 24px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(249,115,22,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 60 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 8, fontSize: '0.85rem' }}>{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
          Proceed to Checkout
        </span>
        <span style={{ fontWeight: 800 }}>₹{total.toFixed(0)} →</span>
      </button>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}