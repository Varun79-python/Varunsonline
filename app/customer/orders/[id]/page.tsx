'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STEPS = [
  { key: 'payment_confirmed', label: 'Payment Confirmed', icon: '✅' },
  { key: 'shop_accepted', label: 'Shop Accepted', icon: '🏪' },
  { key: 'order_packed', label: 'Order Packed', icon: '📦' },
  { key: 'agent_assigned', label: 'Agent Assigned', icon: '🛵' },
  { key: 'picked_up', label: 'Picked Up from Shop', icon: '🏃' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🚴' },
  { key: 'delivered', label: 'Delivered!', icon: '🎉' },
]
const ORDER_RANK: Record<string, number> = { placed: 0, payment_pending: 0, payment_confirmed: 1, shop_accepted: 2, order_packed: 3, agent_assigned: 4, picked_up: 5, out_for_delivery: 6, delivered: 7 }

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [order, setOrder] = useState<Record<string, unknown> | null>(null)
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [address, setAddress] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: o }, { data: i }] = await Promise.all([
        supabase.from('orders').select('*, shops(name, phone, address_line1, city)').eq('id', id).single(),
        supabase.from('order_items').select('*').eq('order_id', id)
      ])
      setOrder(o)
      setItems(i || [])
      if (o?.address_id) {
        const { data: a } = await supabase.from('addresses').select('*').eq('id', o.address_id).single()
        setAddress(a)
      }
    }
    load()
    const ch = supabase.channel('order_' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        payload => setOrder(prev => ({ ...prev, ...payload.new }))
      ).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id])

  if (!order) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} /></div>

  const currentRank = ORDER_RANK[order.status as string] || 0
  const isTerminal = ['delivered', 'cancelled', 'rejected'].includes(order.status as string)

  return (
    <div className="fade-in" style={{ maxWidth: 580, margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: 20, textAlign: 'center', background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(14,165,233,0.08))' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{isTerminal ? (order.status === 'delivered' ? '🎉' : '❌') : '🔄'}</div>
        <h2 style={{ marginBottom: 4 }}>{order.order_number as string}</h2>
        <p style={{ color: 'var(--text-muted)' }}>from {(order.shops as Record<string, unknown>)?.name as string}</p>
      </div>

      {/* Timeline */}
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

      {/* Items */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 14 }}>Order Items</h3>
        {items.map((item: Record<string, unknown>) => (
          <div key={item.id as string} className="flex-between" style={{ marginBottom: 10, fontSize: '0.9rem' }}>
            <span>{item.product_name as string} × {item.quantity as number}</span>
            <span style={{ fontWeight: 600 }}>₹{item.total_price as number}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6 }} className="flex-between">
          <span style={{ fontWeight: 700 }}>Total</span>
          <span style={{ fontWeight: 800, color: 'var(--primary)' }}>₹{order.total_amount as number}</span>
        </div>
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
    </div>
  )
}
