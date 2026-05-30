'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import OrderChat from '@/components/OrderChat/OrderChat'

const STATUS_STEPS = (paymentMethod?: string) => [
  { key: paymentMethod === 'cod' ? 'placed' : 'payment_confirmed', label: paymentMethod === 'cod' ? 'Order Placed' : 'Payment Confirmed', icon: '✅' },
  { key: 'shop_accepted', label: 'Shop Accepted', icon: '🏪' },
  { key: 'order_packed', label: 'Order Packed', icon: '📦' },
  { key: 'agent_assigned', label: 'Agent Assigned', icon: '🛵' },
  { key: 'picked_up', label: 'Picked Up', icon: '🏃' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🚴' },
  { key: 'delivered', label: 'Delivered', icon: '🎉' },
]
const STATUS_RANK: Record<string, number> = {
  placed: 1, payment_confirmed: 1, shop_accepted: 2, order_packed: 3, agent_assigned: 4,
  picked_up: 5, out_for_delivery: 6, delivered: 7, cancelled: 8, rejected: 9
}
const STATUS_COLOR: Record<string, string> = {
  placed: '#2563eb', payment_confirmed: '#22c55e', shop_accepted: '#f97316', order_packed: '#f97316',
  agent_assigned: '#8b5cf6', picked_up: '#8b5cf6', out_for_delivery: '#0ea5e9',
  delivered: '#22c55e', cancelled: '#ef4444', rejected: '#ef4444'
}

interface Order {
  id: string; order_number: string; status: string; payment_method?: string; total_amount: number
  created_at: string; subtotal: number; delivery_charge: number; platform_fee: number
  shopkeeper_earning: number; customer_note?: string; placed_at: string
  accepted_at: string; packed_at: string; picked_up_at: string; delivered_at: string
  items_updated_at?: string
}

interface OrderItem {
  id: string; product_name: string; unit_price: number; quantity: number; total_price: number
}

export default function ShopkeeperOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [shopId, setShopId] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data: shop } = await supabase.from('shops').select('id, owner_id, is_approved, is_active').eq('owner_id', user.id).maybeSingle()
      if (!shop || !shop.is_approved || !shop.is_active) { router.replace('/login/status'); return }
      setShopId(shop.id)

      const { data: o } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single()
      if (!o) return
      setOrder(o as Order)

      const { data: i } = await supabase.from('order_items').select('*').eq('order_id', id)
      setItems(i || [])

      const ch = supabase.channel('shop-order-' + id)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
          async (payload: RealtimePostgresChangesPayload<Order>) => {
            setOrder(prev => prev ? ({ ...prev, ...(payload.new as Order) }) : null)
            // If customer edited items, reload item list
            const newRow = payload.new as Order & { items_updated_at?: string }
            const oldRow = payload.old as Order & { items_updated_at?: string }
            if (newRow.items_updated_at !== oldRow?.items_updated_at) {
              const { data: freshItems } = await supabase.from('order_items').select('*').eq('order_id', id)
              setItems(freshItems || [])
            }
          }
        ).subscribe()
      return () => { supabase.removeChannel(ch) }
    }
    load()
  }, [id])

  async function acceptOrder() {
    await supabase.from('orders').update({ status: 'shop_accepted', accepted_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('order_status_history').insert({ order_id: id, status: 'shop_accepted' })
    setOrder(prev => prev ? { ...prev, status: 'shop_accepted' } : null)
  }

  async function markPacked() {
    await supabase.from('orders').update({ status: 'order_packed', packed_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('order_status_history').insert({ order_id: id, status: 'order_packed' })
    setOrder(prev => prev ? { ...prev, status: 'order_packed' } : null)
  }

  if (!order) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} />
    </div>
  )

  const rank = STATUS_RANK[order.status] || 0
  const isTerminal = ['delivered', 'cancelled', 'rejected'].includes(order.status)

  function fmt(dt: string | null | undefined) {
    if (!dt) return '—'
    return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
  }

  return (
    <div className="fade-in" style={{ maxWidth: 580, margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', marginBottom: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        ← Back
      </button>

      <div className="card" style={{ marginBottom: 16, textAlign: 'center', background: 'linear-gradient(135deg, rgba(249,115,22,0.08), rgba(14,165,233,0.06))' }}>
        <div style={{ fontSize: '2rem', marginBottom: 6 }}>{isTerminal ? (order.status === 'delivered' ? '🎉' : '❌') : '🔄'}</div>
        <h2 style={{ marginBottom: 2 }}>{order.order_number}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {new Date(order.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
        </p>
      </div>

      {!isTerminal && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 14 }}>Order Progress</h3>
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
            {(() => {
              const steps = STATUS_STEPS(order.payment_method)
              return steps.map((step, idx) => {
                const done = rank >= idx + 1
                const active = rank === idx + 1
                return (
                  <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 55, position: 'relative' }}>
                    {idx < steps.length - 1 && (
                    <div style={{ position: 'absolute', top: 14, left: '50%', right: '-50%', height: 2, background: done ? '#22c55e' : '#e2e8f0', zIndex: 0 }} />
                  )}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: done ? '#22c55e' : active ? '#f97316' : '#e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', position: 'relative', zIndex: 1
                  }}>
                    {done ? '✓' : step.icon}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: done || active ? '#1e293b' : '#94a3b8', textAlign: 'center', marginTop: 3, lineHeight: 1.3 }}>
                    {step.label}
                  </div>
                </div>
              )
            })
          })()}
          </div>
        </div>
      )}

      {(order.status === 'payment_confirmed' || order.status === 'placed') && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: '1.5rem' }}>🔔</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>New Order Received!</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Accept to start processing</div>
            </div>
          </div>
          <button onClick={acceptOrder} className="btn btn-primary btn-full">
            ✅ Accept Order
          </button>
        </div>
      )}

      {order.status === 'shop_accepted' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: '1.5rem' }}>📦</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Order Accepted</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Mark as packed when ready</div>
            </div>
          </div>
          <button onClick={markPacked} className="btn btn-primary btn-full">
            📦 Mark as Packed
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>💬 Order Note</h3>
        {order.customer_note ? (
          <div style={{ padding: '8px 12px', background: '#fff7ed', borderRadius: 8, fontSize: '0.82rem', marginBottom: 10 }}>
            📝 {order.customer_note}
          </div>
        ) : (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            No note from customer.
          </div>
        )}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6 }}>
          Customer details are private. Use chat below to communicate.
        </div>
      </div>

      {order.items_updated_at && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: '#fef3c7', border: '1.5px solid #fde68a', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>
          🔔 Customer updated the order items — please review before packing.
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14 }}>🛍️ Order Items ({items.length})</h3>
        {items.map((item: OrderItem) => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.product_name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>₹{item.unit_price} × {item.quantity}</div>
            </div>
            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{item.total_price}</div>
          </div>
        ))}
        <div style={{ borderTop: '2px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
          <div className="flex-between" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Subtotal</span>
            <span>₹{order.subtotal}</span>
          </div>
          <div className="flex-between" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Delivery</span>
            <span>₹{order.delivery_charge}</span>
          </div>
          <div className="flex-between" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Platform Fee</span>
            <span>₹{order.platform_fee}</span>
          </div>
          <div className="flex-between" style={{ borderTop: '1.5px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
            <span style={{ fontWeight: 700 }}>Your Earning</span>
            <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem' }}>₹{order.shopkeeper_earning}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 100 }}>
        <h3 style={{ marginBottom: 12 }}>🕐 Timeline</h3>
        <div className="flex-between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Order Placed</span>
          <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{fmt(order.placed_at)}</span>
        </div>
        <div className="flex-between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Accepted</span>
          <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{fmt(order.accepted_at)}</span>
        </div>
        <div className="flex-between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Packed</span>
          <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{fmt(order.packed_at)}</span>
        </div>
        <div className="flex-between">
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Picked Up</span>
          <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{fmt(order.picked_up_at)}</span>
        </div>
      </div>

      <OrderChat
        orderId={id}
        currentUserId={currentUserId}
        currentUserRole="shopkeeper"
      />
    </div>
  )
}