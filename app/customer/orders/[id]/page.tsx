'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OrderChat from '@/components/OrderChat/OrderChat'

const STEPS = [
  { key: 'payment_confirmed', label: 'Payment Confirmed', icon: '✅' },
  { key: 'shop_accepted', label: 'Shop Accepted', icon: '🏪' },
  { key: 'order_packed', label: 'Order Packed', icon: '📦' },
  { key: 'agent_assigned', label: 'Agent Assigned', icon: '🛵' },
  { key: 'picked_up', label: 'Picked Up from Shop', icon: '🏃' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🚴' },
  { key: 'delivered', label: 'Delivered!', icon: '🎉' },
]
const ORDER_RANK: Record<string, number> = {
  placed: 0, payment_pending: 0, payment_confirmed: 1, shop_accepted: 2,
  order_packed: 3, agent_assigned: 4, picked_up: 5, out_for_delivery: 6, delivered: 7
}
const OTP_VISIBLE = ['shop_accepted', 'order_packed', 'agent_assigned', 'picked_up', 'out_for_delivery']
// Customer can edit items up to (but not including) picked_up
const EDITABLE_STATUSES = ['placed', 'payment_pending', 'payment_confirmed', 'shop_accepted', 'order_packed', 'agent_assigned']

interface OrderItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  product_image_url?: string
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [order, setOrder] = useState<Record<string, unknown> | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [address, setAddress] = useState<Record<string, unknown> | null>(null)
  const [showOtp, setShowOtp] = useState(false)
  const [productRatings, setProductRatings] = useState<Record<string, number>>({})
  const [ratingModal, setRatingModal] = useState<{ productId: string; productName: string } | null>(null)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')

  // Item editing state
  const [editingItems, setEditingItems] = useState(false)
  const [draftItems, setDraftItems] = useState<OrderItem[]>([])
  const [savingItems, setSavingItems] = useState(false)
  const [itemSaveMsg, setItemSaveMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const loadOrder = useCallback(async () => {
    const [{ data: o }, { data: i }, { data: ratings }] = await Promise.all([
      supabase.from('orders').select('*, shops(name, phone, address_line1, city)').eq('id', id).single(),
      supabase.from('order_items').select('*').eq('order_id', id).order('created_at', { ascending: true }),
      supabase.from('product_ratings').select('product_id, rating').eq('order_id', id)
    ])
    setOrder(o)
    setItems(i || [])
    if (ratings) {
      const ratingMap: Record<string, number> = {}
      ratings.forEach((r: { product_id: string; rating: number }) => { ratingMap[r.product_id] = r.rating })
      setProductRatings(ratingMap)
    }
    if (o?.address_id) {
      const { data: a } = await supabase.from('addresses').select('*').eq('id', o.address_id).single()
      setAddress(a)
    }
  }, [id])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setCurrentUserId(user.id) })
    loadOrder()
    const ch = supabase.channel('order_' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload: any) => setOrder(prev => ({ ...prev, ...payload.new }))
      ).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id])

  async function submitProductRating() {
    if (!ratingModal || ratingValue === 0) return
    setRatingSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('product_ratings').upsert({
        order_id: id, product_id: ratingModal.productId,
        customer_id: user.id, rating: ratingValue
      }, { onConflict: 'order_id,product_id,customer_id' })
      setProductRatings(prev => ({ ...prev, [ratingModal.productId]: ratingValue }))
    }
    setRatingValue(0); setRatingModal(null); setRatingSubmitting(false)
  }

  function startEditing() {
    setDraftItems(items.map(i => ({ ...i })))
    setEditingItems(true)
    setItemSaveMsg(null)
  }

  function cancelEditing() {
    setEditingItems(false)
    setDraftItems([])
  }

  function changeQty(idx: number, delta: number) {
    setDraftItems(prev => {
      const next = [...prev]
      const newQty = next[idx].quantity + delta
      if (newQty <= 0) {
        return next.filter((_, i) => i !== idx)
      }
      next[idx] = { ...next[idx], quantity: newQty, total_price: parseFloat((next[idx].unit_price * newQty).toFixed(2)) }
      return next
    })
  }

  function removeItem(idx: number) {
    setDraftItems(prev => prev.filter((_, i) => i !== idx))
  }

  async function saveItems() {
    if (draftItems.length === 0) {
      alert('Order must have at least 1 item.')
      return
    }
    setSavingItems(true)
    setItemSaveMsg(null)
    try {
      const res = await fetch(`/api/orders/${id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: draftItems.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }))
        })
      })
      const json = await res.json()
      if (!res.ok) {
        setItemSaveMsg({ text: json.error || 'Failed to update', ok: false })
      } else {
        setItems(draftItems)
        setOrder(prev => prev ? { ...prev, subtotal: json.subtotal, total_amount: json.total_amount } : prev)
        setEditingItems(false)
        setItemSaveMsg({ text: '✅ Order updated! Shopkeeper has been notified.', ok: true })
      }
    } finally {
      setSavingItems(false)
    }
  }

  const draftSubtotal = draftItems.reduce((s, i) => s + i.total_price, 0)

  if (!order) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const currentRank = ORDER_RANK[order.status as string] || 0
  const isTerminal = ['delivered', 'cancelled', 'rejected'].includes(order.status as string)
  const otpVisible = OTP_VISIBLE.includes(order.status as string)
  const deliveryOtp = order.delivery_otp as string | null
  const canEdit = EDITABLE_STATUSES.includes(order.status as string)

  return (
    <div className="fade-in" style={{ maxWidth: 580, margin: '0 auto', paddingBottom: 120 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.3s ease; }
      `}</style>

      {/* Header */}
      <div className="card" style={{ marginBottom: 20, textAlign: 'center', background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(14,165,233,0.08))' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{isTerminal ? (order.status === 'delivered' ? '🎉' : '❌') : '🔄'}</div>
        <h2 style={{ marginBottom: 4 }}>{order.order_number as string}</h2>
        <p style={{ color: 'var(--text-muted)' }}>from {(order.shops as Record<string, unknown>)?.name as string}</p>
      </div>

      {/* OTP Section */}
      {otpVisible && deliveryOtp && (
        <div style={{ marginBottom: 20, border: '2.5px solid #22c55e', borderRadius: 16, background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.03))', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(34,197,94,0.1)' }}>
            <span style={{ fontSize: '1.2rem' }}>🔐</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#16a34a' }}>Delivery Verification Code</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Share ONLY with delivery agent at doorstep</div>
            </div>
          </div>
          <div style={{ padding: 20, textAlign: 'center' }}>
            {showOtp ? (
              <>
                <div style={{ fontSize: '3.2rem', fontWeight: 900, letterSpacing: '0.5em', color: '#16a34a', fontFamily: 'monospace', background: 'white', padding: '16px 24px', borderRadius: 12, border: '2px dashed rgba(34,197,94,0.4)', display: 'inline-block', marginBottom: 12, userSelect: 'none' }}>
                  {deliveryOtp}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>⚠️ Do not share this code until the agent is at your door</div>
                <button onClick={() => setShowOtp(false)} style={{ background: 'none', border: '1px solid rgba(34,197,94,0.4)', color: '#16a34a', padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem' }}>🙈 Hide Code</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '3.2rem', fontWeight: 900, letterSpacing: '0.5em', color: '#94a3b8', fontFamily: 'monospace', padding: '16px 24px', marginBottom: 12, filter: 'blur(6px)', userSelect: 'none' }}>••••</div>
                <button onClick={() => setShowOtp(true)} style={{ background: '#16a34a', border: 'none', color: 'white', padding: '10px 24px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>👁️ Reveal Code</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delivery verified */}
      {order.status === 'delivered' && (order.otp_verified as boolean) && (
        <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 12, background: 'rgba(34,197,94,0.08)', border: '1.5px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.5rem' }}>✅</span>
          <div>
            <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.9rem' }}>Delivery Verified Successfully!</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Code was verified by the delivery agent</div>
          </div>
        </div>
      )}

      {/* Progress */}
      {!['cancelled', 'rejected'].includes(order.status as string) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 20 }}>Order Progress</h3>
          <div className="timeline">
            {STEPS.map((step, idx) => {
              const stepRank = idx + 1
              const done = currentRank >= stepRank
              const active = currentRank === stepRank
              return (
                <div key={step.key} className="timeline-item">
                  <div className={`timeline-dot ${done ? 'done' : active ? 'active' : ''}`} />
                  <div style={{ opacity: done || active ? 1 : 0.4 }}>
                    <div className="timeline-label">{step.icon} {step.label}</div>
                    {active && <div style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: 2 }}>Current Status</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Save confirmation */}
      {itemSaveMsg && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: itemSaveMsg.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${itemSaveMsg.ok ? '#86efac' : '#fca5a5'}`, color: itemSaveMsg.ok ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: '0.85rem' }}>
          {itemSaveMsg.text}
        </div>
      )}

      {/* Order Items */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Order Items</h3>
          {canEdit && !editingItems && (
            <button
              onClick={startEditing}
              style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', color: '#ea580c', padding: '7px 14px', borderRadius: 9, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              ✏️ Edit Items
            </button>
          )}
          {editingItems && (
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>until pickup only</span>
          )}
        </div>

        {editingItems ? (
          /* ── Edit mode ── */
          <div>
            {draftItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#dc2626', fontSize: '0.85rem' }}>⚠️ Order needs at least 1 item</div>
            )}
            {draftItems.map((item, idx) => (
              <div key={item.product_id + idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                {item.product_image_url
                  ? <img src={item.product_image_url} alt={item.product_name} style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 38, height: 38, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem' }}>🛍️</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>₹{item.unit_price} each</div>
                </div>
                {/* Qty controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => changeQty(idx, -1)} style={{ width: 30, height: 30, border: '1.5px solid #e2e8f0', background: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ width: 28, textAlign: 'center', fontWeight: 700 }}>{item.quantity}</span>
                  <button onClick={() => changeQty(idx, 1)} style={{ width: 30, height: 30, border: '1.5px solid #f97316', background: '#fff7ed', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
                <div style={{ width: 60, textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', color: '#f97316' }}>₹{item.total_price}</div>
                <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1.1rem', padding: '0 4px' }}>🗑️</button>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid var(--border)', marginTop: 4, fontWeight: 700 }}>
              <span>New Subtotal</span>
              <span style={{ color: '#f97316' }}>₹{draftSubtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={cancelEditing} disabled={savingItems} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={saveItems}
                disabled={savingItems || draftItems.length === 0}
                style={{ flex: 2, background: savingItems || draftItems.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 800, color: 'white', cursor: savingItems || draftItems.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                {savingItems ? '⏳ Saving...' : '✅ Confirm Changes'}
              </button>
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <>
            {items.map((item) => {
              const existingRating = productRatings[item.product_id]
              return (
                <div key={item.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div className="flex-between" style={{ marginBottom: 6 }}>
                    <span>{item.product_name} × {item.quantity}</span>
                    <span style={{ fontWeight: 600 }}>₹{item.total_price}</span>
                  </div>
                  {order.status === 'delivered' && (
                    existingRating ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <span style={{ color: '#f59e0b', fontSize: '0.9rem' }}>★</span>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{existingRating}</span>
                        <span style={{ fontSize: '0.75rem', color: '#16a34a' }}> Rated</span>
                      </div>
                    ) : (
                      <button onClick={() => setRatingModal({ productId: item.product_id, productName: item.product_name })}
                        style={{ marginTop: 4, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', padding: '6px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                        ⭐ Rate Product
                      </button>
                    )
                  )}
                </div>
              )
            })}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6 }} className="flex-between">
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 800, color: 'var(--primary)' }}>₹{order.total_amount as number}</span>
            </div>
          </>
        )}
      </div>

      {/* Delivery Address */}
      {address && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12 }}>📍 Delivery Address</h3>
          <p style={{ marginBottom: 4 }}>{String(address.house_name ?? '')}, {String(address.street_name ?? '')}</p>
          {address.landmark ? <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Near: {String(address.landmark)}</p> : null}
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{String(address.city ?? '')}</p>
          {address.latitude ? (
            <a href={`https://maps.google.com/?q=${address.latitude},${address.longitude}`} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--accent)', fontSize: '0.85rem' }}>
              🗺️ View on Google Maps
            </a>
          ) : null}
        </div>
      )}

      {/* Rating Modal */}
      {ratingModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={() => setRatingModal(null)}>
          <div style={{ background: 'white', borderRadius: 24, padding: 24, width: '90%', maxWidth: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>⭐</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Rate Product</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>{ratingModal.productName}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <span key={star} onClick={() => setRatingValue(star)} style={{ fontSize: '2.5rem', cursor: 'pointer', color: star <= ratingValue ? '#f59e0b' : '#d1d5db' }}>
                  {star <= ratingValue ? '★' : '☆'}
                </span>
              ))}
            </div>
            {ratingValue > 0 && (
              <div style={{ textAlign: 'center', marginBottom: 20, fontSize: '0.9rem', color: '#f59e0b', fontWeight: 600 }}>
                {ratingValue === 5 ? 'Excellent!' : ratingValue === 4 ? 'Great!' : ratingValue === 3 ? 'Good' : ratingValue === 2 ? 'Fair' : 'Poor'}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRatingModal(null)} style={{ flex: 1, background: '#f1f5f9', border: 'none', color: '#475569', padding: '14px', borderRadius: 12, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitProductRating} disabled={ratingSubmitting || ratingValue === 0}
                style={{ flex: 1, background: ratingValue === 0 ? '#94a3b8' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', border: 'none', color: 'white', padding: '14px', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: ratingValue === 0 ? 'not-allowed' : 'pointer' }}>
                {ratingSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <OrderChat
        orderId={id}
        currentUserId={currentUserId}
        currentUserRole="customer"
        shopName={(order.shops as Record<string, unknown>)?.name as string}
      />
    </div>
  )
}