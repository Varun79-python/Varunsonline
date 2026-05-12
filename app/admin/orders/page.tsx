'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Order { id: string; order_number: string; status: string; total_amount: number; admin_earning: number; created_at: string; customer_id: string; shop_id: string; payment_method?: string; shops: { name: string } }

export default function AdminOrders() {
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    let q = supabase.from('orders').select('*, shops(name)').order('created_at', { ascending: false }).limit(100)
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter])

  const filtered = search ? orders.filter(o => o.order_number.includes(search) || o.shops?.name?.toLowerCase().includes(search.toLowerCase())) : orders

  const STATUS_OPTIONS = ['all', 'placed', 'payment_confirmed', 'shop_accepted', 'order_packed', 'agent_assigned', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'rejected']
  const STATUS_COLOR: Record<string, string> = { delivered: 'badge-green', cancelled: 'badge-red', rejected: 'badge-red', out_for_delivery: 'badge-blue', payment_confirmed: 'badge-orange' }

  return (
    <div style={{ padding: '0 4px' }}>
      <h2 style={{ marginBottom: 16, fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>📦 Orders</h2>
      
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 150 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem' }}>🔍</span>
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', background: 'white' }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'All' : s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <div style={{ textAlign: 'center', padding: 30 }}>Loading...</div>}
        {!loading && filtered.length === 0 && <div style={{ textAlign: 'center', padding: 30, background: '#f8fafc', borderRadius: 12 }}>No orders found</div>}
        {filtered.map(o => (
          <a key={o.id} href={`/admin/orders/${o.id}`} style={{ display: 'block', background: 'white', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: 14, textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 800, color: '#f97316', fontFamily: 'monospace' }}>{o.order_number}</span>
              <span style={{ background: STATUS_COLOR[o.status] === 'badge-green' ? '#dcfce7' : STATUS_COLOR[o.status] === 'badge-red' ? '#fee2e2' : '#fef3c7', color: STATUS_COLOR[o.status] === 'badge-green' ? '#16a34a' : STATUS_COLOR[o.status] === 'badge-red' ? '#dc2626' : '#d97706', fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{o.status.replace(/_/g, ' ')}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 6 }}>{o.shops?.name}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{o.total_amount}</span>
              <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>Admin: ₹{o.admin_earning || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.65rem', color: '#94a3b8' }}>
              <span>{o.payment_method === 'cod' ? '💵 COD' : '💳 Online'}</span>
              <span>{new Date(o.created_at).toLocaleDateString('en-IN')}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
