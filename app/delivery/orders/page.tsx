'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Order {
  id: string; order_number: string; status: string; agent_earning: number
  total_amount: number; created_at: string; delivery_charge: number
  shops: { name: string; city: string }
  addresses: { house_name: string; street_name: string; city: string }
}

const STATUS_COLOR: Record<string, string> = {
  delivered: 'badge-green', cancelled: 'badge-red', rejected: 'badge-red',
  out_for_delivery: 'badge-blue', picked_up: 'badge-orange', agent_assigned: 'badge-yellow'
}

export default function DeliveryOrdersPage() {
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let q = supabase.from('orders')
      .select('*, shops(name, city), addresses(house_name, street_name, city)')
      .eq('agent_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const totalEarned = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.agent_earning || 0), 0)

  return (
    <div className="fade-in">
      <h2 style={{ marginBottom: 20 }}>📦 My Deliveries</h2>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Deliveries', value: orders.filter(o => o.status === 'delivered').length, icon: '✅' },
          { label: 'Total Earned', value: `₹${totalEarned}`, icon: '💰' },
          { label: 'Active Orders', value: orders.filter(o => ['agent_assigned','picked_up','out_for_delivery'].includes(o.status)).length, icon: '🔄' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: '1.5rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'agent_assigned', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600,
            cursor: 'pointer', border: '1.5px solid',
            borderColor: filter === f ? 'var(--primary)' : 'var(--border)',
            background: filter === f ? 'rgba(249,115,22,0.15)' : 'transparent',
            color: filter === f ? 'var(--primary)' : 'var(--text-muted)'
          }}>{f === 'all' ? 'All' : f.replace(/_/g, ' ')}</button>
        ))}
      </div>

      {/* Orders List */}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>}
      {!loading && orders.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
          <p style={{ color: 'var(--text-muted)' }}>No deliveries found</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orders.map(o => (
          <div key={o.id} className="card" style={{ padding: 16 }}>
            <div className="flex-between" style={{ marginBottom: 10 }}>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>#{o.order_number}</span>
              <span className={`badge ${STATUS_COLOR[o.status] || 'badge-gray'}`}>{o.status.replace(/_/g, ' ')}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              🏪 {o.shops?.name} — {o.shops?.city}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 10 }}>
              📍 {o.addresses?.house_name}, {o.addresses?.street_name}, {o.addresses?.city}
            </div>
            <div className="flex-between">
              <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--success)' }}>+₹{o.agent_earning || 0} earned</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
