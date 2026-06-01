'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import OrderChat from '@/components/OrderChat/OrderChat'

const STATUS_STEPS = [
  { key: 'agent_assigned', label: 'Assigned', icon: '📋' },
  { key: 'picked_up', label: 'Picked Up', icon: '🏃' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🚴' },
  { key: 'delivered', label: 'Delivered', icon: '🎉' },
]
const STATUS_RANK: Record<string, number> = {
  agent_assigned: 1, picked_up: 2, out_for_delivery: 3,
  delivered: 4, cod_pending: 3.5, cod_cash_collected: 4
}

interface Order {
  id: string; order_number: string; status: string; total_amount: number
  created_at: string; agent_earning: number; delivery_charge: number
  delivery_otp: string; customer_id: string; payment_method: string
  payment_status: string; otp_verified: boolean
  shops: { name: string; phone: string; address_line1: string; city: string }
  addresses: { house_name: string; street_name: string; city: string; landmark: string; phone: string }
  profiles: { full_name: string; phone: string }
}

interface OrderItem {
  id: string; order_id: string; product_name: string; quantity: number
  unit_price: number; total_price: number; product_image_url?: string
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (document.getElementById('rzp-script')) { resolve(true); return }
    const s = document.createElement('script')
    s.id = 'rzp-script'
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export default function DeliveryOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [order, setOrder] = useState<Order | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [updating, setUpdating] = useState(false)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [showPaymentOptions, setShowPaymentOptions] = useState(false)
  const [collectingPayment, setCollectingPayment] = useState(false)
  const [paymentMsg, setPaymentMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [qrStep, setQrStep] = useState<'init' | 'show_qr' | 'awaiting_payment' | 'confirmed'>('init')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const { data: o } = await supabase
        .from('orders')
        .select('*, shops(name, phone, address_line1, city), addresses(house_name, street_name, city, landmark, phone), profiles!customer_id(full_name, phone)')
        .eq('id', id)
        .single()
      if (!o) return
      setOrder(o as Order)

      // Fetch order items
      const { data: items } = await supabase
        .from('order_items')
        .select('id, order_id, product_name, quantity, unit_price, total_price, product_image_url')
        .eq('order_id', id)
      setOrderItems(items || [])
    }
    load()
  }, [id])

  useEffect(() => {
    if (!id) return

    const ch = supabase.channel('dl-order-' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload: RealtimePostgresChangesPayload<Order>) => {
          const updated = payload.new as Order
          setOrder(prev => prev ? ({ ...prev, ...updated }) : null)
          // If QR payment was confirmed, show success
          if (updated.payment_status === 'cod_qr_verified' && updated.status === 'delivered') {
            setQrStep('confirmed')
            setPaymentMsg({ text: '✅ QR payment verified! Order delivered.', ok: true })
          }
        }
      ).subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [id])

  async function updateStatus(newStatus: string, field: string) {
    if (updating) return
    setUpdating(true)
    const update: Record<string, string> = { status: newStatus }
    update[field] = new Date().toISOString()
    await supabase.from('orders').update(update).eq('id', id)
    await supabase.from('order_status_history').insert({ order_id: id, status: newStatus })
    setOrder(prev => prev ? { ...prev, status: newStatus } : null)
    setUpdating(false)
  }

  async function handleCollectCash() {
    if (!order || collectingPayment) return
    setCollectingPayment(true)
    setPaymentMsg(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`

      const res = await fetch('/api/delivery/collect-cash', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId: id, paymentMethod: 'cash', idempotencyKey: `cash_${id}` })
      })
      const data = await res.json()

      if (!res.ok) {
        setPaymentMsg({ text: `❌ ${data.error}`, ok: false })
      } else {
        setPaymentMsg({
          text: data.message || `✅ Cash collected! You keep ₹${data.agentKept?.toFixed(2) || order.agent_earning.toFixed(2)}`,
          ok: true
        })
        setOrder(prev => prev ? { ...prev, status: 'delivered', payment_status: 'cod_cash_collected' } : null)
      }
    } catch (err) {
      setPaymentMsg({ text: '❌ Failed to record cash collection', ok: false })
    }
    setCollectingPayment(false)
    setShowPaymentOptions(false)
  }

  async function handlePayViaQR() {
    if (!order || collectingPayment) return
    setCollectingPayment(true)
    setPaymentMsg(null)

    try {
      // 1. Mark order as cod_qr_pending
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`

      const res = await fetch('/api/delivery/collect-cash', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId: id, paymentMethod: 'qr', idempotencyKey: `qr_${id}` })
      })
      const data = await res.json()

      if (!res.ok) {
        setPaymentMsg({ text: `❌ ${data.error}`, ok: false })
        setCollectingPayment(false)
        return
      }

      // 2. Open Razorpay checkout for the order amount
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        setPaymentMsg({ text: '❌ Failed to load payment gateway', ok: false })
        setCollectingPayment(false)
        return
      }

      // Create Razorpay order for this COD payment
      const orderRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: order.total_amount,
          notes: { type: 'cod_qr', orderId: id },
          receipt: `cod_qr_${order.order_number}`
        })
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok) {
        setPaymentMsg({ text: `❌ ${orderData.error}`, ok: false })
        setCollectingPayment(false)
        return
      }

      setQrStep('show_qr')

      // 3. Open Razorpay checkout
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const RazorpayClass: new (opts: any) => any = (window as any).Razorpay
      const rzp = new RazorpayClass({
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Varun's Online",
        description: `COD Order ${order.order_number}`,
        order_id: orderData.id,
        prefill: {},
        theme: { color: '#f97316' },
        handler: async () => {
          // Payment sent. Webhook will verify and complete order.
          setQrStep('awaiting_payment')
          setPaymentMsg({
            text: '⏳ Payment initiated. Waiting for webhook verification...',
            ok: true
          })
        },
        modal: {
          ondismiss: () => {
            setCollectingPayment(false)
            if (qrStep !== 'awaiting_payment') {
              setPaymentMsg({ text: '⚠️ Payment cancelled. You can try again.', ok: false })
            }
          }
        }
      })

      rzp.on('payment.failed', () => {
        setPaymentMsg({ text: '❌ Payment failed. Please try again.', ok: false })
        setCollectingPayment(false)
      })

      rzp.open()
    } catch (err) {
      console.error('QR payment error:', err)
      setPaymentMsg({ text: '❌ Failed to process QR payment', ok: false })
    }
    setCollectingPayment(false)
  }

  if (!order) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} />
    </div>
  )

  const rank = STATUS_RANK[order.status] || 0
  const isCOD = order.payment_method === 'cod'
  const isOutForDelivery = order.status === 'out_for_delivery' && order.otp_verified
  const isDelivered = order.status === 'delivered' || order.status === 'cod_cash_collected'

  return (
    <div className="fade-in" style={{ maxWidth: 580, margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: 16, textAlign: 'center', background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(249,115,22,0.06))' }}>
        <div style={{ fontSize: '2rem', marginBottom: 6 }}>{isDelivered ? '🎉' : '🛵'}</div>
        <h2 style={{ marginBottom: 2 }}>{order.order_number}</h2>
        {isCOD ? (
          <span className="badge badge-orange" style={{ marginBottom: 6 }}>
            💵 COD — Collect Cash
          </span>
        ) : (
          <span className="badge badge-green" style={{ marginBottom: 6 }}>
            ✅ Paid Online
          </span>
        )}
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          Total: <span style={{ fontWeight: 800, color: '#1e293b' }}>₹{order.total_amount}</span>
          &nbsp;|&nbsp;Your earning: <span style={{ color: '#16a34a', fontWeight: 800 }}>₹{order.agent_earning}</span>
        </p>
      </div>

      {/* ── ORDER ITEMS ── */}
      {orderItems.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>🛍️ Items to Deliver</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orderItems.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                {item.product_image_url ? (
                  <img src={item.product_image_url} alt="" loading="lazy" decoding="async" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📦</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{item.product_name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>₹{item.unit_price} each</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>×{item.quantity}</div>
                  <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>₹{item.total_price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {paymentMsg && (
        <div style={{
          background: paymentMsg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${paymentMsg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          color: paymentMsg.ok ? 'var(--success)' : 'var(--danger)', fontWeight: 600
        }}>
          {paymentMsg.text}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14 }}>Delivery Progress</h3>
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
          {STATUS_STEPS.map((step, idx) => {
            const done = rank >= idx + 1
            const active = rank === idx + 1
            return (
              <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 60, position: 'relative' }}>
                {idx < STATUS_STEPS.length - 1 && (
                  <div style={{ position: 'absolute', top: 14, left: '50%', right: '-50%', height: 2, background: done ? '#22c55e' : '#e2e8f0', zIndex: 0 }} />
                )}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: done ? '#22c55e' : active ? '#0ea5e9' : '#e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', position: 'relative', zIndex: 1
                }}>
                  {done ? '✓' : step.icon}
                </div>
                <div style={{ fontSize: '0.62rem', color: done || active ? '#1e293b' : '#94a3b8', textAlign: 'center', marginTop: 3 }}>
                  {step.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Status-specific action cards */}
      {order.status === 'agent_assigned' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: '1.5rem' }}>🏃</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Head to Shop</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pick up the order from the shop</div>
            </div>
          </div>
          <button onClick={() => updateStatus('picked_up', 'picked_up_at')} disabled={updating}
            className="btn btn-primary btn-full">
            {updating ? 'Updating...' : '✅ Confirm Pickup'}
          </button>
        </div>
      )}

      {order.status === 'picked_up' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: '1.5rem' }}>🚴</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Head to Customer</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Deliver to the delivery address</div>
            </div>
          </div>
          <button onClick={() => updateStatus('out_for_delivery', 'out_for_delivery_at')} disabled={updating}
            className="btn btn-primary btn-full">
            {updating ? 'Updating...' : '🚴 Start Delivery'}
          </button>
        </div>
      )}

      {/* ── NON-COD: Regular out_for_delivery action ── */}
      {order.status === 'out_for_delivery' && !isCOD && order.otp_verified && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: '1.5rem' }}>📍</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Arriving Soon!</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Already paid online — just deliver</div>
            </div>
          </div>
          <button onClick={() => updateStatus('delivered', 'delivered_at')} disabled={updating}
            className="btn btn-success btn-full">
            {updating ? 'Updating...' : '🎉 Mark as Delivered'}
          </button>
        </div>
      )}

      {/* ── COD COLLECT PAYMENT SCREEN (only for COD orders) ── */}
      {order.status === 'out_for_delivery' && isCOD && !order.otp_verified && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: '1.5rem' }}>📍</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Arriving Soon!</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Verify OTP from customer first, then collect payment
              </div>
            </div>
          </div>
        </div>
      )}

      {isOutForDelivery && isCOD && !showPaymentOptions && qrStep !== 'awaiting_payment' && (
        <div className="card" style={{ marginBottom: 16, border: '2px solid #f97316' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: '2rem', marginBottom: 4 }}>💵</div>
            <h3 style={{ marginBottom: 2 }}>Collect Payment</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Order total: <strong style={{ fontSize: '1.2rem', color: '#1e293b' }}>₹{order.total_amount}</strong>
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Your earning: ₹{order.agent_earning} | You keep this
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => { setShowPaymentOptions(true); setPaymentMsg(null) }}
              className="btn btn-success btn-full" style={{ padding: '14px', fontSize: '1rem' }}>
              💵 Cash Collected
            </button>
            <button onClick={handlePayViaQR} disabled={collectingPayment}
              className="btn btn-primary btn-full" style={{ padding: '14px', fontSize: '1rem' }}>
              {collectingPayment ? '⏳ Opening...' : '📱 Pay via QR'}
            </button>
          </div>
        </div>
      )}

      {/* Cash confirmation dialog */}
      {isOutForDelivery && showPaymentOptions && (
        <div className="card" style={{ marginBottom: 16, border: '2px solid #22c55e' }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: '2rem', marginBottom: 4 }}>💵</div>
            <h3 style={{ marginBottom: 2 }}>Confirm Cash Collection</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              You collected <strong>₹{order.total_amount}</strong> from customer
            </p>
            <div style={{
              background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8,
              padding: '10px 14px', marginTop: 10, fontSize: '0.82rem', color: '#92400e'
            }}>
              💡 You keep <strong>₹{order.agent_earning}</strong> (your delivery fee).<br />
              Settlement of <strong>₹{(order.total_amount - order.agent_earning).toFixed(2)}</strong> will be auto-recovered from future earnings.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowPaymentOptions(false)}
              className="btn btn-full" style={{ background: 'var(--bg-2)', flex: 1 }}>
              ← Back
            </button>
            <button onClick={handleCollectCash} disabled={collectingPayment}
              className="btn btn-success btn-full" style={{ flex: 2 }}>
              {collectingPayment ? '⏳ Recording...' : `✅ Confirm ₹${order.total_amount} Cash Collected`}
            </button>
          </div>
        </div>
      )}

      {/* QR awaiting payment state */}
      {qrStep === 'awaiting_payment' && (
        <div className="card" style={{ marginBottom: 16, textAlign: 'center', border: '2px solid #0ea5e9' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>⏳</div>
          <h3 style={{ marginBottom: 4 }}>Waiting for Payment</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            Customer scanned QR. Payment will be verified automatically by Razorpay.
          </p>
          <div style={{
            background: 'rgba(14,165,233,0.1)', borderRadius: 8, padding: 12,
            fontSize: '0.82rem', color: '#0369a1'
          }}>
            No action needed. This page updates automatically when payment is confirmed.
          </div>
        </div>
      )}

      {/* Shop info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>🏪 Pickup from Shop</h3>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{order.shops?.name}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{order.shops?.address_line1}, {order.shops?.city}</div>
        {order.shops?.phone && (
          <a href={`tel:${order.shops.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: '0.82rem' }}>
            📞 {order.shops.phone}
          </a>
        )}
      </div>

      {/* Customer info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>📍 Deliver to Customer</h3>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{order.profiles?.full_name}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 4 }}>
          {order.addresses?.house_name}, {order.addresses?.street_name}
        </div>
        {order.addresses?.landmark && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            Near: {order.addresses.landmark}
          </div>
        )}
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 6 }}>{order.addresses?.city}</div>
        {order.addresses?.phone && (
          <a href={`tel:${order.addresses.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.82rem' }}>
            📞 {order.addresses.phone}
          </a>
        )}
      </div>

      {/* OTP display */}
      {order.delivery_otp && (
        <div className="card" style={{ marginBottom: 16, textAlign: 'center', background: 'rgba(34,197,94,0.05)', border: '1.5px solid rgba(34,197,94,0.2)' }}>
          <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, marginBottom: 6 }}>🔐 Delivery OTP</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#16a34a', letterSpacing: '0.4em', fontFamily: 'monospace' }}>
            {order.delivery_otp}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>Share ONLY with customer at doorstep</div>
        </div>
      )}

      {/* Earnings breakdown */}
      <div className="card" style={{ marginBottom: 100 }}>
        <h3 style={{ marginBottom: 10 }}>💰 Earnings Breakdown</h3>
        <div className="flex-between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Delivery Charge</span>
          <span style={{ fontWeight: 600 }}>₹{order.delivery_charge}</span>
        </div>
        <div className="flex-between" style={{ borderTop: '2px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
          <span style={{ fontWeight: 700 }}>Your Earning</span>
          <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '1.1rem' }}>₹{order.agent_earning}</span>
        </div>
      </div>

      <OrderChat
        orderId={id}
        currentUserId={currentUserId}
        currentUserRole="delivery_agent"
        customerName={order.profiles?.full_name ?? ''}
        shopName={order.shops?.name ?? ''}
      />
    </div>
  )
}
