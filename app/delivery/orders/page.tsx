'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Order {
  id: string; order_number: string; status: string; agent_earning: number
  total_amount: number; created_at: string; delivery_charge: number
  shops: { name: string; city: string }
  addresses: { house_name: string; street_name: string; city: string }
}

const STATUS_LABELS: Record<string, string> = {
  agent_assigned: 'Assigned',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected'
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  agent_assigned: { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
  picked_up: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
  out_for_delivery: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  delivered: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  cancelled: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  rejected: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' }
}

export default function DeliveryOrdersPage() {
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    let q = supabase.from('orders')
      .select('*, shops(name, city), addresses(house_name, street_name, city)')
      .eq('agent_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (activeTab === 'active') {
      q = q.in('status', ['agent_assigned', 'picked_up', 'out_for_delivery'])
    } else if (activeTab === 'completed') {
      q = q.eq('status', 'delivered')
    } else if (activeTab === 'cancelled') {
      q = q.in('status', ['cancelled', 'rejected'])
    }
    
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [activeTab])

  const totalEarned = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.agent_earning || 0), 0)

  const tabs = [
    { id: 'active', label: 'Active', count: 0 },
    { id: 'completed', label: 'Completed', count: 0 },
    { id: 'cancelled', label: 'Cancelled', count: 0 }
  ]

  return (
    <div className="fade-in" style={{ padding: '0 12px' }}>
      <h2 style={{ marginBottom: 16 }}>📦 My Orders</h2>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
          <div style={{ fontSize: '1.3rem', marginBottom: 2 }}>✅</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a' }}>{orders.filter(o => o.status === 'delivered').length}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Deliveries</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
          <div style={{ fontSize: '1.3rem', marginBottom: 2 }}>💰</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f97316' }}>₹{totalEarned}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Earned</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
          <div style={{ fontSize: '1.3rem', marginBottom: 2 }}>🔄</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0ea5e9' }}>{orders.filter(o => ['agent_assigned','picked_up','out_for_delivery'].includes(o.status)).length}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Active</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '10px 8px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700,
            cursor: 'pointer', border: '1.5px solid',
            borderColor: activeTab === tab.id ? '#22c55e' : 'var(--border)',
            background: activeTab === tab.id ? 'rgba(34,197,94,0.1)' : 'transparent',
            color: activeTab === tab.id ? '#16a34a' : 'var(--text-muted)'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Orders List */}
      {loading && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Loading...</div>}
      {!loading && orders.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No orders found</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {orders.map(o => {
          const colors = STATUS_COLORS[o.status] || STATUS_COLORS.delivered
          return (
            <div key={o.id} className="dl-order-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>#{o.order_number}</span>
                <span style={{ 
                  fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                  background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`
                }}>{STATUS_LABELS[o.status] || o.status}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                <span style={{ color: '#f97316' }}>🏪</span> {o.shops?.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                <span style={{ color: '#16a34a' }}>📍</span> {o.addresses?.house_name}, {o.addresses?.city}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.9rem' }}>+₹{o.agent_earning || 0}</span>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        .dl-order-card { background: white; border: 1.5px solid var(--border); border-radius: 12px; padding: 14px; }
      `}</style>
    </div>
  )
}
