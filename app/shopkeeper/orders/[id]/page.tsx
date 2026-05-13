'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface OrderItem { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_image_url: string }
interface Order {
  id: string; order_number: string; status: string; total_amount: number
  subtotal: number; shopkeeper_earning: number; created_at: string
  payment_status: string; rejection_reason: string
  addresses: { house_name: string; street_name: string; landmark: string; city: string; latitude: number; longitude: number }
}

const STATUS_COLOR: Record<string, string> = {
  payment_confirmed: '#f59e0b', shop_accepted: '#3b82f6', order_packed: '#8b5cf6',
  out_for_delivery: '#f97316', delivered: '#16a34a', rejected: '#dc2626'
}
const STATUS_LABEL: Record<string, string> = {
  payment_confirmed: '⏳ New Order', shop_accepted: '✅ Accepted', order_packed: '📦 Packed',
  out_for_delivery: '🚴 Out for Delivery', delivered: '✅ Delivered', rejected: '❌ Rejected'
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  useEffect(() => {
    async function load() {
      // Fetch via server API — bypasses RLS so items are visible
      const authHeader = await getAuthHeader()
      const res = await fetch(`/api/shopkeeper/order-detail?orderId=${id}`, { headers: { ...authHeader } })
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setOrder(data.order)
      setItems(data.items || [])
      setLoading(false)
    }
    load()
  }, [id, supabase])

  async function doAction(action: 'accept' | 'reject' | 'pack') {
    if (!order || actionLoading) return
    let reason = ''
    if (action === 'reject') {
      reason = prompt('Reason for rejection (optional):') ?? ''
    }
    setActionLoading(true)
    try {
      const authHeader = await getAuthHeader()
      if (action === 'pack') {
        // Mark packed via service role API
        const res = await fetch('/api/shopkeeper/order-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ orderId: id, action: 'pack' })
        })
        if (res.ok) {
          setOrder(o => o ? { ...o, status: 'order_packed' } : o)
          showToast('📦 Order marked as Packed!')
        }
      } else {
        const authHeader = await getAuthHeader()
        const res = await fetch('/api/shopkeeper/order-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ orderId: id, action, reason })
        })
        const data = await res.json()
        if (res.ok) {
          setOrder(o => o ? { ...o, status: data.newStatus, rejection_reason: reason } : o)
          showToast(action === 'accept' ? '✅ Order Accepted!' : '🚫 Order Rejected')
        } else {
          showToast(`❌ ${data.error || 'Failed to process'}`)
        }
      }
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} />
    </div>
  )
  if (!order) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h3>Order not found</h3>
      <button onClick={() => router.back()} className="btn btn-secondary" style={{ marginTop: 16 }}>← Go Back</button>
    </div>
  )

  const addr = order.addresses as unknown as Order['addresses']

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'white', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontWeight: 600, fontSize: '0.92rem', animation: 'slideIn 0.25s ease' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: 'var(--text-muted)', padding: '4px 8px' }}>←</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>Order {order.order_number}</h2>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{new Date(order.created_at).toLocaleString('en-IN')}</div>
        </div>
        <span style={{ background: (STATUS_COLOR[order.status] || '#94a3b8') + '20', color: STATUS_COLOR[order.status] || '#64748b', padding: '5px 12px', borderRadius: 99, fontWeight: 700, fontSize: '0.8rem', border: `1.5px solid ${(STATUS_COLOR[order.status] || '#94a3b8')}40`, whiteSpace: 'nowrap' }}>
          {STATUS_LABEL[order.status] || order.status}
        </span>
      </div>

      {/* Action buttons based on status */}
      {order.status === 'payment_confirmed' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button className="btn btn-primary" style={{ flex: 1, background: '#16a34a' }} onClick={() => doAction('accept')} disabled={actionLoading}>
            {actionLoading ? '⏳ Processing...' : '✅ Accept Order'}
          </button>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => doAction('reject')} disabled={actionLoading}>
            {actionLoading ? '⏳...' : '❌ Reject'}
          </button>
        </div>
      )}
      {order.status === 'shop_accepted' && (
        <button className="btn btn-primary" style={{ width: '100%', marginBottom: 20 }} onClick={() => doAction('pack')} disabled={actionLoading}>
          {actionLoading ? '⏳ Processing...' : '📦 Mark as Packed'}
        </button>
      )}
      {order.status === 'rejected' && order.rejection_reason && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--danger)', background: '#fef2f2' }}>
          <div style={{ fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>❌ Rejected</div>
          <div style={{ fontSize: '0.88rem' }}>Reason: {order.rejection_reason}</div>
        </div>
      )}

      {/* Items ordered */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14, fontSize: '1rem' }}>🛒 Items Ordered ({items.length})</h3>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            No items found for this order
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {items.map((item, idx) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: idx > 0 ? '1px solid var(--border)' : 'none', background: idx % 2 === 0 ? 'white' : 'var(--bg)' }}>
                {item.product_image_url
                  ? <img src={item.product_image_url} alt={item.product_name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 48, height: 48, background: 'var(--bg3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>🛍️</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{item.product_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>₹{item.unit_price} × {item.quantity}</div>
                </div>
                <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem', flexShrink: 0 }}>₹{item.total_price}</div>
              </div>
            ))}

            {/* Total row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#f8fafc', borderTop: '1.5px dashed #e2e8f0' }}>
              <span style={{ fontWeight: 700, color: '#64748b' }}>Order Total</span>
              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>₹{order.total_amount}</span>
            </div>
          </div>
        )}

        {/* Your Earnings - Highlighted */}
        <div style={{ marginTop: 14, padding: '14px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'white', fontSize: '0.95rem' }}>💰 Your Earnings</span>
            <span style={{ fontWeight: 800, color: 'white', fontSize: '1.3rem' }}>₹{order.shopkeeper_earning}</span>
          </div>
        </div>
      </div>

      

      </div>
  )
}
