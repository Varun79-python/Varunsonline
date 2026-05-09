'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminDashboard() {
  const supabase = createClient()
  const [stats, setStats] = useState({ shops: 0, pendingShops: 0, agents: 0, pendingAgents: 0, customers: 0, orders: 0, todayOrders: 0, todayRevenue: 0, totalRevenue: 0, pendingWithdrawals: 0 })
  const [loading, setLoading] = useState(true)
  const [recentOrders, setRecentOrders] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const [shops, pendShops, agents, pendAgents, customers, orders, todayOrds, withdrawals, recOrders] = await Promise.all([
        supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_approved', true),
        supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_approved', false),
        supabase.from('delivery_agents').select('id', { count: 'exact', head: true }).eq('is_approved', true),
        supabase.from('delivery_agents').select('id', { count: 'exact', head: true }).eq('is_approved', false),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id,admin_earning', { count: 'exact' }).gte('created_at', today).eq('payment_status', 'paid'),
        supabase.from('withdraw_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('*, shops(name)').order('created_at', { ascending: false }).limit(8)
      ])
      const todayRev = (todayOrds.data || []).reduce((s: number, o: { admin_earning: number }) => s + (o.admin_earning || 0), 0)
      setStats({ shops: shops.count || 0, pendingShops: pendShops.count || 0, agents: agents.count || 0, pendingAgents: pendAgents.count || 0, customers: customers.count || 0, orders: orders.count || 0, todayOrders: todayOrds.count || 0, todayRevenue: todayRev, totalRevenue: 0, pendingWithdrawals: withdrawals.count || 0 })
      setRecentOrders(recOrders.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const statCards = [
    { icon: '🏪', label: 'Active Shops', value: stats.shops, sub: `${stats.pendingShops} pending`, color: '#0ea5e9', href: '/admin/shops' },
    { icon: '🛵', label: 'Active Agents', value: stats.agents, sub: `${stats.pendingAgents} pending`, color: '#22c55e', href: '/admin/agents' },
    { icon: '👥', label: 'Customers', value: stats.customers, sub: 'total registered', color: '#a855f7', href: '/admin/customers' },
    { icon: '📦', label: "Today's Orders", value: stats.todayOrders, sub: `${stats.orders} total`, color: '#f97316', href: '/admin/orders' },
    { icon: '💰', label: "Today's Revenue", value: `₹${stats.todayRevenue.toFixed(0)}`, sub: 'admin earnings', color: '#eab308', href: '/admin/orders' },
    { icon: '💸', label: 'Pending Withdrawals', value: stats.pendingWithdrawals, sub: 'awaiting approval', color: '#ef4444', href: '/admin/withdrawals' },
  ]

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} /></div>

  return (
    <div className="fade-in">
      <h2 style={{ marginBottom: 6 }}>📊 Platform Overview</h2>
      <p style={{ marginBottom: 28 }}>Full control of Varun&apos;s Online platform</p>

      <div className="grid-3" style={{ marginBottom: 32 }}>
        {statCards.map(s => (
          <a key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div className="stat-icon" style={{ background: `${s.color}20`, fontSize: '1.5rem' }}>{s.icon}</div>
              <div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>{s.sub}</div>
              </div>
            </div>
          </a>
        ))}
      </div>

      <h3 style={{ marginBottom: 16 }}>Recent Orders</h3>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Order #</th><th>Shop</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {recentOrders.map((o: Record<string, unknown>) => (
              <tr key={o.id as string}>
                <td><a href={`/admin/orders/${o.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{o.order_number as string}</a></td>
                <td>{(o.shops as { name: string })?.name}</td>
                <td>₹{o.total_amount as number}</td>
                <td><span className={`badge ${(o.status as string) === 'delivered' ? 'badge-green' : (o.status as string) === 'cancelled' ? 'badge-red' : 'badge-orange'}`}>{o.status as string}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{new Date(o.created_at as string).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
