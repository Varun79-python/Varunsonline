'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
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
  agent_assigned: 1, picked_up: 2, out_for_delivery: 3, delivered: 4
}

interface Order {
  id: string; order_number: string; status: string; total_amount: number
  created_at: string; agent_earning: number; delivery_charge: number
  delivery_otp: string; customer_id: string
  shops: { name: string; phone: string; address_line1: string; city: string }
  addresses: { house_name: string; street_name: string; city: string; landmark: string; phone: string }
  profiles: { full_name: string; phone: string }
}

export default function DeliveryOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [order, setOrder] = useState<Order | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [updating, setUpdating] = useState(false)

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

      const ch = supabase.channel('dl-order-' + id)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
          (payload: RealtimePostgresChangesPayload<Order>) =>
            setOrder(prev => prev ? ({ ...prev, ...(payload.new as Order) }) : null)
        ).subscribe()
      return () => { supabase.removeChannel(ch) }
    }
    load()
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

  if (!order) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} />
    </div>
  )

  const rank = STATUS_RANK[order.status] || 0

  return (
    <div className="fade-in" style={{ maxWidth: 580, margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: 16, textAlign: 'center', background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(249,115,22,0.06))' }}>
        <div style={{ fontSize: '2rem', marginBottom: 6 }}>{order.status === 'delivered' ? '🎉' : '🛵'}</div>
        <h2 style={{ marginBottom: 2 }}>{order.order_number}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          Earning: <span style={{ color: '#16a34a', fontWeight: 800 }}>₹{order.agent_earning}</span>
        </p>
      </div>

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

      {order.status === 'out_for_delivery' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: '1.5rem' }}>📍</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Arriving Soon!</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Complete the delivery with OTP verification</div>
            </div>
          </div>
          <button onClick={() => updateStatus('delivered', 'delivered_at')} disabled={updating}
            className="btn btn-success btn-full">
            {updating ? 'Updating...' : '🎉 Mark as Delivered'}
          </button>
        </div>
      )}

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

      {order.delivery_otp && (
        <div className="card" style={{ marginBottom: 16, textAlign: 'center', background: 'rgba(34,197,94,0.05)', border: '1.5px solid rgba(34,197,94,0.2)' }}>
          <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, marginBottom: 6 }}>🔐 Delivery OTP</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#16a34a', letterSpacing: '0.4em', fontFamily: 'monospace' }}>
            {order.delivery_otp}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>Share ONLY with customer at doorstep</div>
        </div>
      )}

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
        customerName={(order.profiles as Record<string, unknown>)?.full_name as string}
        shopName={(order.shops as Record<string, unknown>)?.name as string}
      />
    </div>
  )
}