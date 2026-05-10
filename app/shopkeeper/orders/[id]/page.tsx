'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Order {
  id: string; order_number: string; status: string; total_amount: number
  subtotal: number; platform_fee: number; delivery_charge: number
  discount_amount: number; shopkeeper_earning: number; created_at: string
  accepted_at: string; packed_at: string; payment_status: string
  coupon_code: string; rejection_reason: string
  addresses: { house_name: string; street_name: string; landmark: string; city: string; latitude: number; longitude: number }
}
interface OrderItem {
  id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_image_url: string
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

  useEffect(() => {
    async function load() {
      const [{ data: ord }, { data: itms }] = await Promise.all([
        supabase.from('orders').select('*, addresses(*)').eq('id', id).single(),
        supabase.from('order_items').select('*').eq('order_id', id)
      ])
      setOrder(ord)
      setItems(itms || [])
      setLoading(false)
    }
    load()
  }, [id])

  async function accept() {
    if (!order || actionLoading) return
    setActionLoading(true)
    const { error } = await supabase.from('orders').update({ status: 'shop_accepted', accepted_at: new Date().toISOString() }).eq('id', id)
    if (!error) {
      await supabase.from('order_status_history').insert({ order_id: id, status: 'shop_accepted' })
      setOrder(o => o ? { ...o, status: 'shop_accepted' } : o)
    } else { alert('Failed to accept order. Please try again.') }
    setActionLoading(false)
  }

  async function reject() {
    if (!order || actionLoading) return
    const reason = prompt('Reason for rejection (optional):') || ''
    setActionLoading(true)
    const { error } = await supabase.from('orders').update({ status: 'rejected', rejection_reason: reason }).eq('id', id)
    if (!error) {
      await supabase.from('order_status_history').insert({ order_id: id, status: 'rejected' })
      setOrder(o => o ? { ...o, status: 'rejected', rejection_reason: reason } : o)
    } else { alert('Failed to reject order.') }
    setActionLoading(false)
  }

  async function markPacked() {
    if (!order || actionLoading) return
    setActionLoading(true)
    const { error } = await supabase.from('orders').update({ status: 'order_packed', packed_at: new Date().toISOString() }).eq('id', id)
    if (!error) {
      await supabase.from('order_status_history').insert({ order_id: id, status: 'order_packed' })
      setOrder(o => o ? { ...o, status: 'order_packed' } : o)
    }
    setActionLoading(false)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} /></div>
  if (!order) return <div style={{ padding: 40, textAlign: 'center' }}><h3>Order not found</h3><button onClick={() => router.back()} className="btn btn-secondary" style={{ marginTop: 16 }}>← Go Back</button></div>

  const addr = order.addresses as unknown as Order['addresses']

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}>←</button>
        <div>
          <h2 style={{ margin: 0 }}>Order {order.order_number}</h2>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{new Date(order.created_at).toLocaleString('en-IN')}</div>
        </div>
        <span style={{ marginLeft: 'auto', background: STATUS_COLOR[order.status] + '20', color: STATUS_COLOR[order.status], padding: '4px 12px', borderRadius: 99, fontWeight: 700, fontSize: '0.82rem', border: `1.5px solid ${STATUS_COLOR[order.status]}40` }}>
          {STATUS_LABEL[order.status] || order.status}
        </span>
      </div>

      {/* Action buttons based on status */}
      {order.status === 'payment_confirmed' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={accept} disabled={actionLoading}>
            {actionLoading ? '⏳ Processing...' : '✅ Accept Order'}
          </button>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={reject} disabled={actionLoading}>
            {actionLoading ? '⏳...' : '❌ Reject'}
          </button>
        </div>
      )}
      {order.status === 'shop_accepted' && (
        <button className="btn btn-primary btn-full" style={{ marginBottom: 20 }} onClick={markPacked} disabled={actionLoading}>
          {actionLoading ? '⏳ Processing...' : '📦 Mark as Packed'}
        </button>
      )}
      {order.status === 'rejected' && order.rejection_reason && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--danger)', background: '#fef2f2' }}>
          <div style={{ fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>❌ Rejected</div>
          <div style={{ fontSize: '0.88rem' }}>Reason: {order.rejection_reason}</div>
        </div>
      )}

      {/* Order items */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14, fontSize: '1rem' }}>🛒 Items Ordered</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {item.product_image_url
                  ? <img src={item.product_image_url} alt={item.product_name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                  : <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🛍️</div>
                }
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.product_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>₹{item.unit_price} × {item.quantity}</div>
                </div>
              </div>
              <div style={{ fontWeight: 700 }}>₹{item.total_price}</div>
            </div>
          ))}
        </div>

        {/* Bill summary */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1.5px dashed var(--border)' }}>
          {([
            ['Subtotal', order.subtotal],
            ['Delivery Charge', order.delivery_charge],
            [`Platform Fee`, order.platform_fee],
            ...(order.discount_amount > 0 ? [['Coupon Discount', -order.discount_amount]] : []),
          ] as [string, number][]).map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.86rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{l}</span>
              <span style={{ color: v < 0 ? 'var(--success)' : 'inherit' }}>{v < 0 ? '−' : ''}₹{Math.abs(v || 0)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 6, borderTop: '1.5px solid var(--border)', fontWeight: 800 }}>
            <span>Total</span>
            <span style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>₹{order.total_amount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Your Earnings</span>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>₹{order.shopkeeper_earning}</span>
          </div>
        </div>
      </div>

      {/* Delivery address */}
      {addr && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10, fontSize: '1rem' }}>📍 Delivery Address</h3>
          <div style={{ fontSize: '0.9rem' }}>
            <div style={{ fontWeight: 600 }}>{addr.house_name}</div>
            <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
              {addr.street_name}{addr.landmark ? `, near ${addr.landmark}` : ''}, {addr.city}
            </div>
            {addr.latitude && (
              <a href={`https://maps.google.com/?q=${addr.latitude},${addr.longitude}`} target="_blank" rel="noreferrer"
                style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: 6, display: 'inline-block' }}>
                📌 Open in Google Maps →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Payment info */}
      <div className="card">
        <h3 style={{ marginBottom: 10, fontSize: '1rem' }}>💳 Payment</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Status</span>
          <span style={{ fontWeight: 700, color: order.payment_status === 'paid' ? 'var(--success)' : 'var(--danger)' }}>
            {order.payment_status === 'paid' ? '✅ Paid' : order.payment_status}
          </span>
        </div>
        {order.coupon_code && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.88rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Coupon</span>
            <span style={{ fontWeight: 600 }}>{order.coupon_code}</span>
          </div>
        )}
      </div>
    </div>
  )
}
