'use client'
import { useEffect, useState } from 'react'
import { getAdminStats } from '@/app/admin/actions'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ shops: 0, pendingShops: 0, agents: 0, pendingAgents: 0, customers: 0, orders: 0, todayOrders: 0, todayRevenue: 0, totalRevenue: 0, pendingWithdrawals: 0, complaints: 0 })
  const [loading, setLoading] = useState(true)
  const [recentOrders, setRecentOrders] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    async function load() {
      try {
        const { stats: fetchedStats, recentOrders: fetchedRecent } = await getAdminStats()
        setStats(fetchedStats)
        setRecentOrders(fetchedRecent)
      } catch (err) {
        console.error('Failed to load admin stats:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const statCards = [
    { icon: '🏪', label: 'Active Shops', value: stats.shops, sub: `${stats.pendingShops} pending`, color: '#0ea5e9', bg: '#f0f9ff', href: '/admin/shops' },
    { icon: '🛵', label: 'Active Agents', value: stats.agents, sub: `${stats.pendingAgents} pending`, color: '#22c55e', bg: '#f0fdf4', href: '/admin/agents' },
    { icon: '👥', label: 'Customers', value: stats.customers, sub: 'registered', color: '#a855f7', bg: '#faf5ff', href: '/admin/customers' },
    { icon: '📦', label: "Today's Orders", value: stats.todayOrders, sub: `${stats.orders} total`, color: '#f97316', bg: '#fff7ed', href: '/admin/orders' },
    { icon: '💰', label: "Today's Earnings", value: `₹${stats.todayRevenue.toFixed(0)}`, sub: 'platform revenue', color: '#eab308', bg: '#fefce8', href: '/admin/orders' },
    { icon: '💸', label: 'Withdrawals', value: stats.pendingWithdrawals, sub: 'pending', color: '#ef4444', bg: '#fef2f2', href: '/admin/withdrawals' },
    { icon: '🎫', label: 'Complaints', value: stats.complaints, sub: 'open tickets', color: '#f59e0b', bg: '#fffbeb', href: '/admin/complaints' },
  ]

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} /></div>

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      delivered: { bg: '#dcfce7', text: '#16a34a' },
      cancelled: { bg: '#fee2e2', text: '#dc2626' },
      rejected: { bg: '#fee2e2', text: '#dc2626' },
      payment_confirmed: { bg: '#fef3c7', text: '#d97706' },
      shop_accepted: { bg: '#dbeafe', text: '#2563eb' },
      order_packed: { bg: '#e0e7ff', text: '#4f46e5' },
      out_for_delivery: { bg: '#dcfce7', text: '#16a34a' },
    }
    const c = colors[status] || { bg: '#f1f5f9', text: '#64748b' }
    return <span style={{ background: c.bg, color: c.text, fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{status.replace('_', ' ')}</span>
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h2 style={{ marginBottom: 4, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>📊 Command Center</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {statCards.map(s => (
          <a key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ background: s.bg }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4 }}>{s.sub}</div>
            </div>
          </a>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>⚡ Quick Actions</h3>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
          {stats.pendingShops > 0 && (
            <a href="/admin/shops?tab=pending" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: 'white', borderRadius: 10, padding: '12px 16px', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>🏪 {stats.pendingShops} Shop Approvals</a>
          )}
          {stats.pendingAgents > 0 && (
            <a href="/admin/agents?tab=pending" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', borderRadius: 10, padding: '12px 16px', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>🛵 {stats.pendingAgents} Agent Approvals</a>
          )}
          {stats.pendingWithdrawals > 0 && (
            <a href="/admin/withdrawals" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', borderRadius: 10, padding: '12px 16px', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>💸 {stats.pendingWithdrawals} Withdrawals</a>
          )}
          {stats.complaints > 0 && (
            <a href="/admin/complaints" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', borderRadius: 10, padding: '12px 16px', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>🎫 {stats.complaints} Complaints</a>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>📦 Recent Orders</h3>
          <a href="/admin/orders" style={{ color: '#f97316', fontSize: '0.8rem', fontWeight: 600 }}>View All →</a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recentOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, background: '#f8fafc', borderRadius: 12 }}>No recent orders</div>
          ) : (
            recentOrders.map((o: Record<string, unknown>) => (
              <a key={o.id as string} href={`/admin/orders/${o.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', borderRadius: 10, padding: 12, border: '1.5px solid #e2e8f0', textDecoration: 'none' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>{o.order_number as string}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{(o.shops as { name: string })?.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color: '#f97316', fontSize: '0.95rem' }}>₹{o.total_amount as number}</div>
                  {getStatusBadge(o.status as string)}
                </div>
              </a>
            ))
          )}
        </div>
      </div>

      <style>{`
        .dashboard-container { max-width: 1400px; margin: 0 auto; }
        .dashboard-header { margin-bottom: 24px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
        .stat-card { border-radius: 16px; padding: 20px; text-align: center; border: 1px solid; transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
        
        @media (max-width: 1200px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .stat-card { padding: 14px 10px; }
          .dashboard-container { padding: 0; }
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
