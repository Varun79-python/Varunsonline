'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Order { id: string; order_number: string; status: string; total_amount: number; admin_earning: number; created_at: string; customer_id: string; shop_id: string; shops: { name: string } }

export default function AdminOrders() {
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [statusFilter])

  async function load() {
    setLoading(true)
    let q = supabase.from('orders').select('*, shops(name)').order('created_at', { ascending: false }).limit(100)
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }

  const filtered = search ? orders.filter(o => o.order_number.includes(search) || o.shops?.name?.toLowerCase().includes(search.toLowerCase())) : orders

  const STATUS_OPTIONS = ['all', 'placed', 'payment_confirmed', 'shop_accepted', 'order_packed', 'agent_assigned', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'rejected']
  const STATUS_COLOR: Record<string, string> = { delivered: 'badge-green', cancelled: 'badge-red', rejected: 'badge-red', out_for_delivery: 'badge-blue', payment_confirmed: 'badge-orange' }

  return (
    <div className="fade-in">
      <h2 style={{ marginBottom: 20 }}>📦 All Orders</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon">🔍</span>
          <input placeholder="Search order # or shop..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 200 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Order #</th><th>Shop</th><th>Amount</th><th>Admin Earn</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>Loading...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>No orders found</td></tr>}
            {filtered.map(o => (
              <tr key={o.id}>
                <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{o.order_number}</td>
                <td>{o.shops?.name}</td>
                <td>₹{o.total_amount}</td>
                <td style={{ color: 'var(--success)' }}>₹{o.admin_earning || 0}</td>
                <td><span className={`badge ${STATUS_COLOR[o.status] || 'badge-gray'}`}>{o.status.replace(/_/g, ' ')}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
