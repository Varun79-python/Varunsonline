'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAdminStats } from '@/app/admin/actions'

interface RecentOrder {
  id: string
  order_number: string
  total_amount: number
  status: string
  shops: { name: string } | null
}

const MODULES = [
  { icon: '📦', title: 'Orders', desc: 'Track & manage all orders', href: '/admin/orders', color: '#2563EB' },
  { icon: '🏪', title: 'Shops', desc: 'Manage shop registrations', href: '/admin/shops', color: '#059669' },
  { icon: '🛵', title: 'Agents', desc: 'Manage delivery fleet', href: '/admin/agents', color: '#D97706' },
  { icon: '👥', title: 'Users', desc: 'View customer profiles', href: '/admin/customers', color: '#7C3AED' },
  { icon: '💸', title: 'Payouts', desc: 'Process withdrawals', href: '/admin/withdrawals', color: '#DC2626' },
  { icon: '💳', title: 'Settlement', desc: 'Agent settlements', href: '/admin/agent-settlements', color: '#0891B2' },
  { icon: '💰', title: 'COD Due', desc: 'COD collections due', href: '/admin/cod-settlements', color: '#65A30D' },
  { icon: '📋', title: 'Plans', desc: 'Subscription plans', href: '/admin/plans', color: '#9333EA' },
  { icon: '🏷️', title: 'Coupons', desc: 'Discount coupons', href: '/admin/coupons', color: '#E11D48' },
  { icon: '🎫', title: 'Tickets', desc: 'Support complaints', href: '/admin/complaints', color: '#F59E0B' },
  { icon: '💎', title: 'Revenue', desc: 'Financial analytics', href: '/admin/revenue', color: '#0EA5E9' },
  { icon: '⚙️', title: 'Settings', desc: 'Admin configuration', href: '/admin/settings', color: '#64748B' },
]

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  placed: { bg: '#DBEAFE', text: '#2563EB' },
  delivered: { bg: '#DCFCE7', text: '#16A34A' },
  cancelled: { bg: '#FEE2E2', text: '#DC2626' },
  rejected: { bg: '#FEE2E2', text: '#DC2626' },
  payment_confirmed: { bg: '#FEF3C7', text: '#D97706' },
  shop_accepted: { bg: '#DBEAFE', text: '#2563EB' },
  order_packed: { bg: '#E0E7FF', text: '#4F46E5' },
  out_for_delivery: { bg: '#DCFCE7', text: '#16A34A' },
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    shops: 0, pendingShops: 0, agents: 0, pendingAgents: 0,
    customers: 0, orders: 0, todayOrders: 0, todayRevenue: 0,
    totalRevenue: 0, pendingWithdrawals: 0, complaints: 0
  })
  const [loading, setLoading] = useState(true)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])

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

  const getStatusBadge = (status: string) => {
    const c = STATUS_BADGES[status] || { bg: '#F1F5F9', text: '#64748B' }
    return (
      <span style={{ background: c.bg, color: c.text, fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
        {status.replace(/_/g, ' ')}
      </span>
    )
  }

  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#2563EB', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div className="cc">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="cc-header">
        <div>
          <div className="cc-brand">{"Varun's Online"}</div>
          <div className="cc-title">Admin Command Center</div>
          <div className="cc-subtitle">Welcome back • {dateStr}</div>
        </div>
      </div>

      {/* ── Scrollable Module Cards ────────────────────────────── */}
      <div className="cc-section-label">Modules</div>
      <div className="cc-modules">
        {MODULES.map(m => (
          <a key={m.href} href={m.href} className="cc-module-card">
            <div className="cc-module-icon" style={{ background: `${m.color}12` }}>
              <span style={{ fontSize: '1.5rem' }}>{m.icon}</span>
            </div>
            <div className="cc-module-title">{m.title}</div>
            <div className="cc-module-desc">{m.desc}</div>
          </a>
        ))}
      </div>

      {/* ── Statistics ─────────────────────────────────────────── */}
      <div className="cc-section-label">Overview</div>
      <div className="cc-stats-grid">
        <a href="/admin/shops" className="cc-stat-card">
          <div className="cc-stat-icon" style={{ background: '#EFF6FF' }}>🏪</div>
          <div className="cc-stat-value" style={{ color: '#2563EB' }}>{stats.shops}</div>
          <div className="cc-stat-label">Active Shops</div>
          <div className="cc-stat-sub">{stats.pendingShops > 0 ? `${stats.pendingShops} pending` : 'All approved'}</div>
        </a>
        <a href="/admin/agents" className="cc-stat-card">
          <div className="cc-stat-icon" style={{ background: '#F0FDF4' }}>🛵</div>
          <div className="cc-stat-value" style={{ color: '#22C55E' }}>{stats.agents}</div>
          <div className="cc-stat-label">Active Agents</div>
          <div className="cc-stat-sub">{stats.pendingAgents > 0 ? `${stats.pendingAgents} pending` : 'All approved'}</div>
        </a>
        <a href="/admin/customers" className="cc-stat-card">
          <div className="cc-stat-icon" style={{ background: '#FAF5FF' }}>👥</div>
          <div className="cc-stat-value" style={{ color: '#7C3AED' }}>{stats.customers}</div>
          <div className="cc-stat-label">Customers</div>
          <div className="cc-stat-sub">Registered users</div>
        </a>
        <a href="/admin/orders" className="cc-stat-card">
          <div className="cc-stat-icon" style={{ background: '#FFF7ED' }}>📦</div>
          <div className="cc-stat-value" style={{ color: '#F97316' }}>{stats.todayOrders}</div>
          <div className="cc-stat-label">Today's Orders</div>
          <div className="cc-stat-sub">{stats.orders} total</div>
        </a>
        <a href="/admin/revenue" className="cc-stat-card">
          <div className="cc-stat-icon" style={{ background: '#FEFCE8' }}>💰</div>
          <div className="cc-stat-value" style={{ color: '#EAB308' }}>₹{stats.todayRevenue.toFixed(0)}</div>
          <div className="cc-stat-label">Today's Earnings</div>
          <div className="cc-stat-sub">Platform revenue</div>
        </a>
        <a href="/admin/withdrawals" className="cc-stat-card">
          <div className="cc-stat-icon" style={{ background: '#FEF2F2' }}>💸</div>
          <div className="cc-stat-value" style={{ color: '#EF4444' }}>{stats.pendingWithdrawals}</div>
          <div className="cc-stat-label">Withdrawals</div>
          <div className="cc-stat-sub">{stats.pendingWithdrawals > 0 ? 'Pending' : 'None pending'}</div>
        </a>
        <a href="/admin/complaints" className="cc-stat-card">
          <div className="cc-stat-icon" style={{ background: '#FFFBEB' }}>🎫</div>
          <div className="cc-stat-value" style={{ color: '#F59E0B' }}>{stats.complaints}</div>
          <div className="cc-stat-label">Complaints</div>
          <div className="cc-stat-sub">{stats.complaints > 0 ? 'Open tickets' : 'No open tickets'}</div>
        </a>
        <a href="/admin/revenue" className="cc-stat-card cc-stat-highlight">
          <div className="cc-stat-icon" style={{ background: '#F5F3FF' }}>💎</div>
          <div className="cc-stat-value" style={{ color: '#7C3AED' }}>₹{stats.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          <div className="cc-stat-label">Total Revenue</div>
          <div className="cc-stat-sub">View analytics ↗</div>
        </a>
      </div>

      {/* ── Quick Actions ──────────────────────────────────────── */}
      {(stats.pendingShops > 0 || stats.pendingAgents > 0 || stats.pendingWithdrawals > 0 || stats.complaints > 0) && (
        <>
          <div className="cc-section-label">Quick Actions</div>
          <div className="cc-actions-row">
            {stats.pendingShops > 0 && (
              <a href="/admin/shops?tab=pending" className="cc-action-card" style={{ borderLeftColor: '#2563EB' }}>
                <span className="cc-action-icon">🏪</span>
                <div className="cc-action-body">
                  <div className="cc-action-count">{stats.pendingShops}</div>
                  <div className="cc-action-text">Shop Approvals</div>
                </div>
                <span className="cc-action-arrow">→</span>
              </a>
            )}
            {stats.pendingAgents > 0 && (
              <a href="/admin/agents?tab=pending" className="cc-action-card" style={{ borderLeftColor: '#22C55E' }}>
                <span className="cc-action-icon">🛵</span>
                <div className="cc-action-body">
                  <div className="cc-action-count">{stats.pendingAgents}</div>
                  <div className="cc-action-text">Agent Approvals</div>
                </div>
                <span className="cc-action-arrow">→</span>
              </a>
            )}
            {stats.pendingWithdrawals > 0 && (
              <a href="/admin/withdrawals" className="cc-action-card" style={{ borderLeftColor: '#EF4444' }}>
                <span className="cc-action-icon">💸</span>
                <div className="cc-action-body">
                  <div className="cc-action-count">{stats.pendingWithdrawals}</div>
                  <div className="cc-action-text">Pending Withdrawals</div>
                </div>
                <span className="cc-action-arrow">→</span>
              </a>
            )}
            {stats.complaints > 0 && (
              <a href="/admin/complaints" className="cc-action-card" style={{ borderLeftColor: '#F59E0B' }}>
                <span className="cc-action-icon">🎫</span>
                <div className="cc-action-body">
                  <div className="cc-action-count">{stats.complaints}</div>
                  <div className="cc-action-text">Open Tickets</div>
                </div>
                <span className="cc-action-arrow">→</span>
              </a>
            )}
          </div>
        </>
      )}

      {/* ── Recent Orders ──────────────────────────────────────── */}
      <div className="cc-section-label">Recent Orders</div>
      <div className="cc-recent-card">
        {recentOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#94A3B8', fontSize: '0.85rem' }}>No recent orders</div>
        ) : (
          <>
            <div className="cc-recent-list">
              {recentOrders.map((o: RecentOrder) => (
                <a key={o.id} href={`/admin/orders/${o.id}`} className="cc-recent-item">
                  <div className="cc-recent-left">
                    <div className="cc-recent-order-no">{o.order_number}</div>
                    <div className="cc-recent-shop">{o.shops?.name || '—'}</div>
                  </div>
                  <div className="cc-recent-right">
                    <div className="cc-recent-amount">₹{o.total_amount}</div>
                    {getStatusBadge(o.status)}
                  </div>
                </a>
              ))}
            </div>
            <div className="cc-recent-footer">
              <Link href="/admin/orders" className="cc-view-all">View All Orders →</Link>
            </div>
          </>
        )}
      </div>

      <style>{`
        .cc { max-width: 1000px; margin: 0 auto; }

        /* ── Header ── */
        .cc-header { margin-bottom: 28px; }
        .cc-brand { font-size: 0.75rem; font-weight: 700; color: #2563EB; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
        .cc-title { font-size: 1.65rem; font-weight: 800; color: #0F172A; line-height: 1.2; margin-bottom: 4px; }
        .cc-subtitle { font-size: 0.85rem; color: #64748B; }

        /* ── Section Labels ── */
        .cc-section-label { font-size: 0.75rem; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }

        /* ── Module Cards (horizontal scroll) ── */
        .cc-modules {
          display: flex;
          gap: 12px;
          margin-bottom: 32px;
          overflow-x: auto;
          WebkitOverflowScrolling: touch;
          scroll-snap-type: x mandatory;
          padding-bottom: 4px;
        }
        .cc-modules::-webkit-scrollbar { height: 4px; }
        .cc-modules::-webkit-scrollbar-track { background: transparent; }
        .cc-modules::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
        .cc-module-card {
          background: white;
          border-radius: 16px;
          border: 1.5px solid #E2E8F0;
          padding: 18px 14px;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          cursor: pointer;
        }
        .cc-module-card { min-width: 140px; scroll-snap-align: start; }
        .cc-module-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.07); }
        .cc-module-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cc-module-title { font-size: 0.85rem; font-weight: 700; color: #0F172A; text-align: center; }
        .cc-module-desc { font-size: 0.68rem; color: #94A3B8; text-align: center; line-height: 1.3; }

        /* ── Statistics Grid ── */
        .cc-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
        .cc-stat-card {
          background: white;
          border-radius: 16px;
          border: 1.5px solid #E2E8F0;
          padding: 18px 16px;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          cursor: pointer;
        }
        .cc-stat-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .cc-stat-highlight { border-color: #E9D5FF; background: linear-gradient(135deg, #FAF5FF 0%, #F5F3FF 100%); }
        .cc-stat-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
        .cc-stat-value { font-size: 1.4rem; font-weight: 800; line-height: 1.1; }
        .cc-stat-label { font-size: 0.78rem; font-weight: 600; color: #64748B; }
        .cc-stat-sub { font-size: 0.68rem; color: #94A3B8; }

        /* ── Quick Actions ── */
        .cc-actions-row { display: flex; gap: 12px; margin-bottom: 32px; flex-wrap: wrap; }
        .cc-action-card {
          flex: 1;
          min-width: 180px;
          background: white;
          border-radius: 14px;
          border: 1.5px solid #E2E8F0;
          border-left: 4px solid;
          padding: 14px 16px;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          cursor: pointer;
        }
        .cc-action-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .cc-action-icon { font-size: 1.5rem; flex-shrink: 0; }
        .cc-action-body { flex: 1; }
        .cc-action-count { font-size: 1.3rem; font-weight: 800; color: #0F172A; line-height: 1.1; }
        .cc-action-text { font-size: 0.75rem; color: #64748B; font-weight: 600; }
        .cc-action-arrow { font-size: 1rem; color: #CBD5E1; flex-shrink: 0; }

        /* ── Recent Orders ── */
        .cc-recent-card {
          background: white;
          border-radius: 16px;
          border: 1.5px solid #E2E8F0;
          overflow: hidden;
        }
        .cc-recent-list { display: flex; flex-direction: column; }
        .cc-recent-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 18px;
          text-decoration: none;
          border-bottom: 1px solid #F1F5F9;
          transition: background 0.1s ease;
        }
        .cc-recent-item:last-child { border-bottom: none; }
        .cc-recent-item:hover { background: #F8FAFC; }
        .cc-recent-left { }
        .cc-recent-order-no { font-size: 0.85rem; font-weight: 700; color: #0F172A; font-family: monospace; }
        .cc-recent-shop { font-size: 0.72rem; color: #64748B; margin-top: 2px; }
        .cc-recent-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .cc-recent-amount { font-size: 0.9rem; font-weight: 700; color: #0F172A; }
        .cc-recent-footer {
          border-top: 1px solid #E2E8F0;
          padding: 12px 18px;
          text-align: center;
        }
        .cc-view-all {
          font-size: 0.8rem;
          font-weight: 700;
          color: #2563EB;
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .cc-view-all:hover { opacity: 0.7; }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .cc-stats-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 900px) {
          .cc-modules { gap: 10px; }
        }
        @media (max-width: 640px) {
          .cc-title { font-size: 1.3rem; }
          .cc-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .cc-modules { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .cc-stat-card { padding: 14px 12px; }
          .cc-stat-value { font-size: 1.2rem; }
          .cc-module-card { padding: 14px 10px; }
          .cc-module-icon { width: 40px; height: 40px; }
          .cc-action-card { min-width: 140px; }
          .cc-recent-item { padding: 10px 14px; }
        }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
