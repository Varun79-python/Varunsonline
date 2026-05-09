'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Address { id: string; label: string; house_name: string; street_name: string; landmark: string; city: string; latitude: number; longitude: number }
interface CartItem { product_id: string; name: string; price: number; quantity: number; shop_id: string; shop_name: string; image_url: string }

declare global { interface Window { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } } }

export default function CheckoutContent() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const [cart, setCart] = useState<CartItem[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddr, setSelectedAddr] = useState<string>('')
  const [showNewAddr, setShowNewAddr] = useState(false)
  const [gettingGPS, setGettingGPS] = useState(false)
  const [addr, setAddr] = useState({ house_name: '', street_name: '', landmark: '', city: '', state: '', pincode: '', latitude: 0, longitude: 0 })
  const [loading, setLoading] = useState(false)
  const [deliveryCharge, setDeliveryCharge] = useState(30)
  const [platformFeePercent, setPlatformFeePercent] = useState(5)

  const couponDiscount = Number(params.get('discount') || 0)
  const couponCode = params.get('coupon') || ''

  useEffect(() => {
    setCart(JSON.parse(localStorage.getItem('vo_cart') || '[]'))
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [addrRes, settingsRes] = await Promise.all([
      supabase.from('addresses').select('*').eq('customer_id', user.id),
      supabase.from('platform_settings').select('key,value').in('key', ['base_delivery_charge', 'platform_fee_percent'])
    ])
    setAddresses(addrRes.data || [])
    if (addrRes.data?.length) setSelectedAddr(addrRes.data[0]?.id || '')
    settingsRes.data?.forEach((s: { key: string; value: string }) => {
      if (s.key === 'base_delivery_charge') setDeliveryCharge(Number(s.value))
      if (s.key === 'platform_fee_percent') setPlatformFeePercent(Number(s.value))
    })
  }

  function getGPS() {
    setGettingGPS(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setAddr(a => ({ ...a, latitude: pos.coords.latitude, longitude: pos.coords.longitude })); setGettingGPS(false) },
      () => setGettingGPS(false)
    )
  }

  async function saveAddress() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('addresses').insert({ customer_id: user.id, ...addr }).select().single()
    if (data) { setAddresses(a => [...a, data]); setSelectedAddr(data.id); setShowNewAddr(false) }
  }

  async function placeOrder() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !selectedAddr || cart.length === 0) return
    setLoading(true)
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
    const pfee = Math.round((subtotal * platformFeePercent) / 100)
    const total = subtotal + deliveryCharge + pfee - couponDiscount
    const agentEarning = Math.round(deliveryCharge * 0.8)
    const shopEarning = subtotal - pfee

    try {
      const rzpRes = await fetch('/api/payment/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total })
      })
      const rzpData = await rzpRes.json()

      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      document.body.appendChild(script)
      script.onload = () => {
        const rzp = new window.Razorpay({
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: total * 100,
          currency: 'INR',
          name: "Varun's Online",
          description: `Order from ${cart[0].shop_name}`,
          order_id: rzpData.id,
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            const { data: order } = await supabase.from('orders').insert({
              customer_id: user.id, shop_id: cart[0].shop_id, address_id: selectedAddr,
              status: 'payment_confirmed', payment_status: 'paid',
              subtotal, platform_fee: pfee, delivery_charge: deliveryCharge,
              discount_amount: couponDiscount, total_amount: total,
              shopkeeper_earning: shopEarning, agent_earning: agentEarning,
              admin_earning: pfee + (deliveryCharge - agentEarning),
              coupon_code: couponCode || null,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }).select().single()

            if (order) {
              await supabase.from('order_items').insert(cart.map(i => ({
                order_id: order.id, product_id: i.product_id, product_name: i.name,
                product_image_url: i.image_url, quantity: i.quantity,
                unit_price: i.price, total_price: i.price * i.quantity
              })))
              await supabase.from('order_status_history').insert({ order_id: order.id, status: 'payment_confirmed', changed_by: user.id })
              await supabase.from('notifications').insert({
                user_id: cart[0].shop_id, title: '🛒 New Order!',
                body: `Order ${order.order_number} received`, type: 'new_order',
                data: { order_id: order.id }
              })
              localStorage.removeItem('vo_cart')
              router.push(`/customer/orders/${order.id}`)
            }
          },
          prefill: { name: user.user_metadata?.full_name, email: user.email },
          theme: { color: '#f97316' }
        })
        rzp.open()
      }
    } catch (err) {
      console.error(err)
      alert('Payment failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const pfee = Math.round((subtotal * platformFeePercent) / 100)
  const total = subtotal + deliveryCharge + pfee - couponDiscount

  return (
    <div className="fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24 }}>📦 Checkout</h2>

      {/* Delivery Address */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>📍 Delivery Address</h3>
        {addresses.map(a => (
          <label key={a.id} style={{ display: 'flex', gap: 12, padding: '12px', borderRadius: 8, border: `1.5px solid ${selectedAddr === a.id ? 'var(--primary)' : 'var(--border)'}`, marginBottom: 8, cursor: 'pointer', background: selectedAddr === a.id ? 'rgba(249,115,22,0.08)' : 'transparent' }}>
            <input type="radio" name="addr" value={a.id} checked={selectedAddr === a.id} onChange={() => setSelectedAddr(a.id)} />
            <div>
              <div style={{ fontWeight: 600 }}>{a.label} — {a.house_name}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{a.street_name}{a.landmark ? `, near ${a.landmark}` : ''}, {a.city}</div>
              {a.latitude ? (
                <a href={`https://maps.google.com/?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>
                  📌 {a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}
                </a>
              ) : null}
            </div>
          </label>
        ))}
        <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => setShowNewAddr(!showNewAddr)}>+ Add New Address</button>

        {showNewAddr && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'var(--bg3)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group"><label className="input-label">House/Building Name</label><input className="input" placeholder="e.g. Sunrise Apartments" value={addr.house_name} onChange={e => setAddr(a => ({ ...a, house_name: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Street Name</label><input className="input" placeholder="e.g. MG Road" value={addr.street_name} onChange={e => setAddr(a => ({ ...a, street_name: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Landmark</label><input className="input" placeholder="Near City Mall" value={addr.landmark} onChange={e => setAddr(a => ({ ...a, landmark: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">City</label><input className="input" placeholder="City" value={addr.city} onChange={e => setAddr(a => ({ ...a, city: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={getGPS} disabled={gettingGPS}>{gettingGPS ? '📡 Detecting...' : '📍 Get GPS Location'}</button>
              {addr.latitude !== 0 && <span style={{ fontSize: '0.82rem', color: 'var(--success)' }}>✅ {addr.latitude.toFixed(5)}, {addr.longitude.toFixed(5)}</span>}
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveAddress}>Save Address</button>
          </div>
        )}
      </div>

      {/* Order Summary */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 14 }}>Order Summary</h3>
        {cart.map(i => (
          <div key={i.product_id} className="flex-between" style={{ marginBottom: 8, fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{i.name} × {i.quantity}</span>
            <span style={{ fontWeight: 600 }}>₹{(i.price * i.quantity).toFixed(0)}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
          {([
            ['Subtotal', subtotal],
            ['Delivery Charge', deliveryCharge],
            [`Platform Fee (${platformFeePercent}%)`, pfee],
            ...(couponDiscount > 0 ? [['Coupon Discount', -couponDiscount]] : [])
          ] as [string, number][]).map(([l, v]) => (
            <div key={l} className="flex-between" style={{ marginBottom: 6, fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{l}</span>
              <span style={{ color: v < 0 ? 'var(--success)' : 'inherit' }}>{v < 0 ? '−' : ''}₹{Math.abs(v).toFixed(0)}</span>
            </div>
          ))}
          <div className="flex-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6 }}>
            <span style={{ fontWeight: 700 }}>Total</span>
            <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.15rem' }}>₹{total.toFixed(0)}</span>
          </div>
        </div>
      </div>

      <button className="btn btn-primary btn-full btn-lg" onClick={placeOrder} disabled={loading || !selectedAddr || cart.length === 0}>
        {loading ? 'Processing...' : `💳 Pay ₹${total.toFixed(0)} with Razorpay`}
      </button>
    </div>
  )
}
