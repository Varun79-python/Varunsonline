'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Address { id: string; label: string; house_name: string; street_name: string; landmark: string; city: string; latitude: number; longitude: number; phone?: string }
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
  const [addr, setAddr] = useState({ label: 'Home', house_name: '', street_name: '', landmark: '', city: '', state: '', pincode: '', phone: '', latitude: 0, longitude: 0 })
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'address' | 'summary'>('address')
  const [deliveryCharge, setDeliveryCharge] = useState(30)
  const [platformFeePercent, setPlatformFeePercent] = useState(5)

  const couponDiscount = Number(params.get('discount') || 0)
  const couponCode = params.get('coupon') || ''
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const pfee = Math.round((subtotal * platformFeePercent) / 100)
  const total = subtotal + deliveryCharge + pfee - couponDiscount
  const [paymentMode, setPaymentMode] = useState<'online' | 'cod'>('online')
  const [codLoading, setCodLoading] = useState(false)

  useEffect(() => {
    setCart(JSON.parse(localStorage.getItem('vo_cart') || '[]'))
    loadData()
    // Pre-load Razorpay script once, quietly
    const existing = document.getElementById('rzp-script')
    if (!existing) {
      const s = document.createElement('script')
      s.id = 'rzp-script'
      s.src = 'https://checkout.razorpay.com/v1/checkout.js'
      s.async = true
      document.head.appendChild(s)
    }
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
    if (!addr.house_name || !addr.street_name || !addr.city) {
      alert('Please fill House Name, Street and City')
      return
    }
    if (!addr.phone) {
      alert('Please enter your phone number for the delivery agent')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Please login first'); return }

    const payload = {
      customer_id: user.id,
      label: addr.label || 'Home',
      house_name: addr.house_name,
      street_name: addr.street_name,
      landmark: addr.landmark || null,
      city: addr.city,
      pincode: addr.pincode || null,
      phone: addr.phone,
      latitude: addr.latitude !== 0 ? addr.latitude : null,
      longitude: addr.longitude !== 0 ? addr.longitude : null,
    }

    const { data, error } = await supabase.from('addresses').insert(payload).select().single()
    if (error) {
      console.error('Save address error:', error)
      alert('Failed to save address: ' + error.message)
      return
    }
    if (data) {
      setAddresses(a => [...a, data])
      setSelectedAddr(data.id)
      setShowNewAddr(false)
      // Reset form
      setAddr({ label: 'Home', house_name: '', street_name: '', landmark: '', city: '', state: '', pincode: '', phone: '', latitude: 0, longitude: 0 })
    }
  }

  async function placeFreeOrder(userId: string) {
    const agentEarning = Math.round(deliveryCharge * 0.8)
    const shopEarning = subtotal - pfee
    const { data: order } = await supabase.from('orders').insert({
      customer_id: userId, shop_id: cart[0].shop_id, address_id: selectedAddr,
      status: 'payment_confirmed', payment_method: 'free', payment_status: 'paid',
      subtotal, platform_fee: pfee, delivery_charge: deliveryCharge,
      discount_amount: couponDiscount, total_amount: 0,
      shopkeeper_earning: shopEarning, agent_earning: agentEarning,
      admin_earning: pfee + (deliveryCharge - agentEarning),
      coupon_code: couponCode || null,
    }).select().single()
    if (order) {
      await supabase.from('order_items').insert(cart.map(i => ({
        order_id: order.id, product_id: i.product_id, product_name: i.name,
        product_image_url: i.image_url, quantity: i.quantity,
        unit_price: i.price, total_price: i.price * i.quantity
      })))
      await supabase.from('order_status_history').insert({ order_id: order.id, status: 'payment_confirmed', changed_by: userId })
      localStorage.removeItem('vo_cart')
      router.push(`/customer/orders/${order.id}`)
    }
  }

  async function placeCodOrder() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !selectedAddr || cart.length === 0) return
    setCodLoading(true)
    const agentEarning = Math.round(deliveryCharge * 0.8)
    const shopEarning = subtotal - pfee
    try {
      const res = await fetch('/api/orders/place-cod', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user.id, shopId: cart[0].shop_id, addressId: selectedAddr,
          cart, subtotal, deliveryCharge, platformFee: pfee,
          couponDiscount, total, agentEarning, shopEarning,
          adminEarning: pfee + (deliveryCharge - agentEarning),
          couponCode: couponCode || null
        })
      })
      const data = await res.json()
      if (data.success) {
        localStorage.removeItem('vo_cart')
        router.push(`/customer/orders/${data.orderId}`)
      } else {
        alert('Failed to place order: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      console.error(err)
      alert('Failed to place COD order. Please try again.')
    } finally {
      setCodLoading(false)
    }
  }

  async function placeOrder() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !selectedAddr || cart.length === 0) return
    setLoading(true)

    // Free order (₹0 total) — skip Razorpay entirely
    if (total <= 0) {
      await placeFreeOrder(user.id)
      setLoading(false)
      return
    }

    const agentEarning = Math.round(deliveryCharge * 0.8)
    const shopEarning = subtotal - pfee

    try {
      const rzpRes = await fetch('/api/payment/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total })
      })
      const rzpData = await rzpRes.json()
      if (!rzpRes.ok || !rzpData.id) throw new Error(rzpData.error || 'Could not create payment order')

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: total * 100,
        currency: 'INR',
        name: "Varun's Online",
        description: `Order from ${cart[0].shop_name}`,
        order_id: rzpData.id,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch('/api/payment/verify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          })
          const verifyData = await verifyRes.json()
          if (!verifyRes.ok || !verifyData.verified) {
            alert('Payment verification failed. Please contact support.')
            return
          }
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
            try {
              await supabase.from('notifications').insert({
                user_id: cart[0].shop_id, title: '🛒 New Order!',
                body: `Order ${order.order_number} received`, type: 'new_order',
                data: { order_id: order.id }
              })
            } catch { /* optional */ }
            localStorage.removeItem('vo_cart')
            router.push(`/customer/orders/${order.id}`)
          }
        },
        prefill: { name: user.user_metadata?.full_name, email: user.email },
        theme: { color: '#f97316' }
      })
      rzp.open()
    } catch (err) {
      console.error(err)
      alert('Payment failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (cart.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>🛒</div>
      <h3 style={{ marginBottom: 8 }}>Your cart is empty</h3>
      <p style={{ marginBottom: 20 }}>Add items from a shop first</p>
      <button onClick={() => router.push('/customer')} className="btn btn-primary">Browse Shops →</button>
    </div>
  )

  return (
    <div className="fade-in" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <h2>📦 Checkout</h2>
        <span className="badge badge-orange">{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Step tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab ${step === 'address' ? 'active' : ''}`} onClick={() => setStep('address')}>📍 Address</button>
        <button className={`tab ${step === 'summary' ? 'active' : ''}`} onClick={() => setStep('summary')}>📋 Summary & Pay</button>
      </div>

      {/* STEP 1: Address */}
      {step === 'address' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 14, fontSize: '1rem' }}>📍 Select Delivery Address</h3>

            {addresses.length === 0 && !showNewAddr && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                <p style={{ marginBottom: 12 }}>No saved addresses. Add one below.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {addresses.map(a => (
                <label key={a.id} style={{
                  display: 'flex', gap: 12, padding: '12px 14px',
                  borderRadius: 10, border: `1.5px solid ${selectedAddr === a.id ? 'var(--primary)' : 'var(--border)'}`,
                  cursor: 'pointer', background: selectedAddr === a.id ? '#fff7ed' : 'var(--bg3)',
                  transition: 'all 0.15s'
                }}>
                  <input type="radio" name="addr" value={a.id} checked={selectedAddr === a.id} onChange={() => setSelectedAddr(a.id)} style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{a.label} — {a.house_name}</div>
                    <div style={{ fontSize: '0.81rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {a.street_name}{a.landmark ? `, near ${a.landmark}` : ''}, {a.city}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <button
              className="btn btn-outline btn-sm"
              style={{ marginTop: 14 }}
              onClick={() => setShowNewAddr(!showNewAddr)}
            >
              {showNewAddr ? '✕ Cancel' : '+ Add New Address'}
            </button>

            {showNewAddr && (
              <div style={{ marginTop: 14, padding: 16, background: 'var(--bg3)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div className="input-group">
                    <label className="input-label">Label</label>
                    <select className="input" value={addr.label} onChange={e => setAddr(a => ({ ...a, label: e.target.value }))}>
                      {['Home', 'Work', 'Other'].map(l => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">House / Building *</label>
                    <input className="input" placeholder="e.g. Sunrise Apartments" value={addr.house_name} onChange={e => setAddr(a => ({ ...a, house_name: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Street / Area *</label>
                    <input className="input" placeholder="e.g. MG Road" value={addr.street_name} onChange={e => setAddr(a => ({ ...a, street_name: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">City *</label>
                    <input className="input" placeholder="City" value={addr.city} onChange={e => setAddr(a => ({ ...a, city: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Landmark</label>
                    <input className="input" placeholder="Near City Mall" value={addr.landmark} onChange={e => setAddr(a => ({ ...a, landmark: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Pincode</label>
                    <input className="input" placeholder="500001" value={addr.pincode} onChange={e => setAddr(a => ({ ...a, pincode: e.target.value }))} />
                  </div>
                  <div className="input-group" style={{ gridColumn: '1/-1' }}>
                    <label className="input-label">📞 Phone Number * <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(shared with delivery agent only)</span></label>
                    <input className="input" type="tel" placeholder="+91 9XXXXXXXXX" value={addr.phone} onChange={e => setAddr(a => ({ ...a, phone: e.target.value }))} required />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                  <button className="btn btn-secondary btn-sm" onClick={getGPS} disabled={gettingGPS}>
                    {gettingGPS ? '📡 Detecting...' : '📍 Get GPS Location'}
                  </button>
                  {addr.latitude !== 0 && <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600 }}>✅ GPS captured</span>}
                </div>
                <button className="btn btn-primary btn-sm" onClick={saveAddress}>💾 Save Address</button>
              </div>
            )}
          </div>

          <button
            className="btn btn-primary btn-full btn-lg"
            disabled={!selectedAddr}
            onClick={() => setStep('summary')}
          >
            Continue to Summary →
          </button>
        </div>
      )}

      {/* STEP 2: Summary & Pay */}
      {step === 'summary' && (
        <div>
          {/* Selected address summary */}
          {selectedAddr && (() => {
            const a = addresses.find(x => x.id === selectedAddr)
            return a ? (
              <div className="card" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => setStep('address')}>
                <div className="flex-between">
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Delivering to</div>
                    <div style={{ fontWeight: 700 }}>{a.label} — {a.house_name}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{a.street_name}{a.landmark ? `, near ${a.landmark}` : ''}, {a.city}</div>
                  </div>
                  <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>Change</span>
                </div>
              </div>
            ) : null
          })()}

          {/* Order items */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 14, fontSize: '1rem' }}>🛒 Order Items</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cart.map(i => (
                <div key={i.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{i.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>₹{i.price} × {i.quantity}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text)' }}>₹{(i.price * i.quantity).toFixed(0)}</div>
                </div>
              ))}
            </div>

            {/* Bill */}
            <div style={{ borderTop: '1.5px dashed var(--border)', marginTop: 16, paddingTop: 14 }}>
              {([
                ['Subtotal', subtotal],
                ['Delivery Charge', deliveryCharge],
                [`Platform Fee (${platformFeePercent}%)`, pfee],
                ...(couponDiscount > 0 ? [['Coupon Discount', -couponDiscount]] : [])
              ] as [string, number][]).map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.87rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                  <span style={{ color: v < 0 ? 'var(--success)' : 'var(--text)', fontWeight: 500 }}>
                    {v < 0 ? '−' : ''}₹{Math.abs(v).toFixed(0)}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1.5px solid var(--border)' }}>
                <span style={{ fontWeight: 800, fontSize: '1rem' }}>Total</span>
                <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.2rem' }}>₹{total.toFixed(0)}</span>
              </div>
            </div>
          </div>

          {/* Payment Mode Selector */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 14, fontSize: '1rem' }}>💳 Payment Method</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{
                display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10,
                border: `2px solid ${paymentMode === 'online' ? '#f97316' : '#e2e8f0'}`,
                cursor: 'pointer', background: paymentMode === 'online' ? '#fff7ed' : 'white'
              }}>
                <input type="radio" name="payment" value="online" checked={paymentMode === 'online'} onChange={() => setPaymentMode('online')} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>💳 Pay Online</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>UPI, Card, Net Banking</div>
                </div>
              </label>
              <label style={{
                display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10,
                border: `2px solid ${paymentMode === 'cod' ? '#16a34a' : '#e2e8f0'}`,
                cursor: 'pointer', background: paymentMode === 'cod' ? '#f0fdf4' : 'white'
              }}>
                <input type="radio" name="payment" value="cod" checked={paymentMode === 'cod'} onChange={() => setPaymentMode('cod')} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>💵 Cash on Delivery</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Pay when delivered</div>
                </div>
              </label>
            </div>
          </div>

          {paymentMode === 'cod' ? (
            <>
              <div style={{ background: '#fefce8', border: '1.5px solid #fde047', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: '0.83rem', color: '#854d0e' }}>
                💡 <strong>Cash on Delivery:</strong> Pay ₹{total.toFixed(0)} in cash to the delivery agent. They will show you a QR code or collect cash at your doorstep.
              </div>
              <button
                className="btn btn-full btn-lg"
                onClick={placeCodOrder}
                disabled={codLoading || !selectedAddr}
                style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, padding: '14px', fontSize: '1rem', cursor: 'pointer', opacity: (!selectedAddr || codLoading) ? 0.6 : 1 }}
              >
                {codLoading ? '⏳ Placing Order...' : `💵 Place COD Order — ₹${total.toFixed(0)}`}
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={placeOrder}
              disabled={loading || !selectedAddr || cart.length === 0}
              style={{ fontSize: '1rem' }}
            >
              {loading ? '⏳ Processing...' : total <= 0 ? '🎉 Place Free Order' : `💳 Pay ₹${total.toFixed(0)} Securely`}
            </button>
          )}

          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 10 }}>
            🔒 Secured by Razorpay · By ordering you agree to our terms
          </p>
        </div>
      )}
    </div>
  )
}
