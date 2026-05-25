'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnalyticsData {
  orders: {
    delivered: number; total: number; cancelled: number; rejected: number
    avgOrderValue: number; highestOrderValue: number; lowestOrderValue: number
    failedPayments: number; refundedPayments: number; cancelledLoss: number
    statusCounts: Record<string, number>
  }
  customer: {
    totalCustomerPaid: number; totalProductAmount: number; totalDeliveryFee: number
    totalPlatformFee: number; totalCouponDiscount: number
    totalCodAmount: number; totalOnlineAmount: number; onlinePct: number; codPct: number
  }
  agent: {
    totalDeliveryEarnings: number; totalCodCashCollected: number
    pendingCodSettlement: number; completedSettlements: number
    negativeBalanceAgents: number; totalWalletBalance: number
    totalLifetimeEarnings: number; withdrawalsPaid: number; withdrawalsPending: number
  }
  shopkeeper: {
    totalProductEarnings: number; totalWalletBalance: number; totalLifetimeEarnings: number
    withdrawalsPaid: number; withdrawalsPending: number
    topShops: { name: string; earnings: number; orders: number }[]
    subscriptionRevenue: number; paidSubscriptions: number
    activeSubscriptions: number; expiredSubscriptions: number
  }
  admin: {
    totalRevenue: number; orderEarnings: number; platformFeeEarnings: number
    deliveryCommissionEarnings: number; subscriptionEarnings: number
    couponCost: number; cancelledLoss: number; refundLoss: number
    grossInflow: number; grossOutflow: number; netRevenue: number
    netProfit: number; totalLosses: number
  }
  trend: {
    daily: { date: string; revenue: number }[]
    highestRevenueDay: { date: string; revenue: number }
    lowestRevenueDay: { date: string; revenue: number }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
function pct(a: number, b: number) {
  if (!b) return '0%'
  return (Math.round((a / b) * 100)) + '%'
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: '1.4rem' }}>{icon}</span>
        <h3 style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1e293b', margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: 'white', borderRadius: 14, padding: '18px 20px',
      border: `1.5px solid ${accent ? accent + '40' : '#e2e8f0'}`,
      boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
      borderLeft: accent ? `4px solid ${accent}` : undefined
    }}>
      {children}
    </div>
  )
}

function Row({ label, value, sub, color, bold }: { label: string; value: string; sub?: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
      <span style={{ fontSize: '0.83rem', color: '#64748b' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontWeight: bold ? 800 : 700, fontSize: bold ? '1rem' : '0.88rem', color: color || '#1e293b' }}>{value}</span>
        {sub && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{sub}</div>}
      </div>
    </div>
  )
}

function StatBox({ icon, label, value, sub, color = '#f97316' }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: color + '0d', border: `1px solid ${color}30`,
      borderRadius: 12, padding: '14px 16px', textAlign: 'center'
    }}>
      <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: '1.2rem', color }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Mini Bar Chart (30-day trend) ─────────────────────────────────────────────
function TrendChart({ data }: { data: { date: string; revenue: number }[] }) {
  const max = Math.max(...data.map(d => d.revenue), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.date}: ₹${d.revenue}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
          <div style={{
            width: '100%', background: d.revenue > 0 ? '#7c3aed' : '#e2e8f0',
            borderRadius: 2, height: `${Math.max(4, (d.revenue / max) * 100)}%`,
            transition: 'height 0.3s ease', cursor: 'pointer', opacity: 0.85
          }} />
        </div>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminRevenueAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'customer' | 'agent' | 'shopkeeper' | 'admin'>('overview')

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const headers: Record<string, string> = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` } : {}
        const res = await fetch('/api/admin/revenue-analytics', { headers })
        if (!res.ok) throw new Error('Failed to load analytics')
        setData(await res.json())
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#7c3aed', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#64748b', marginTop: 16 }}>Loading analytics…</p>
      <style>{`@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error || !data) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#ef4444' }}>❌ {error || 'No data'}</div>
  )

  const TABS = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'customer', label: '👤 Customer' },
    { key: 'agent', label: '🛵 Agent' },
    { key: 'shopkeeper', label: '🏪 Shopkeeper' },
    { key: 'admin', label: '💎 Admin P&L' },
  ] as const

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontWeight: 900, fontSize: '1.6rem', color: '#0f172a', margin: 0 }}>💎 Revenue Analytics</h2>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: '0.88rem' }}>Complete financial command center — Varun&apos;s Online</p>
      </div>

      {/* Hero Revenue Strip */}
      <div style={{
        background: 'linear-gradient(135deg, #4c1d95, #7c3aed, #a855f7)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 28,
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16
      }}>
        {[
          { label: 'Net Platform Revenue', value: fmt(data.admin.totalRevenue), sub: 'orders + subscriptions' },
          { label: 'Gross Customer Inflow', value: fmt(data.customer.totalCustomerPaid), sub: 'all delivered orders' },
          { label: 'Subscription Revenue', value: fmt(data.shopkeeper.subscriptionRevenue), sub: `${data.shopkeeper.paidSubscriptions} paid plans` },
          { label: 'Today\'s Revenue', value: '—', sub: 'see dashboard card' },
        ].map((h, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>{h.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', fontWeight: 600, marginTop: 4 }}>{h.label}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{h.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 24, paddingBottom: 4 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap',
            background: tab === t.key ? '#7c3aed' : '#f1f5f9',
            color: tab === t.key ? 'white' : '#475569',
            transition: 'all 0.15s ease'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
            <StatBox icon="📦" label="Delivered Orders" value={data.orders.delivered} sub={`${data.orders.total} total placed`} color="#f97316" />
            <StatBox icon="💰" label="Avg Order Value" value={fmt(data.orders.avgOrderValue)} sub="per delivered order" color="#0ea5e9" />
            <StatBox icon="🏆" label="Highest Order" value={fmt(data.orders.highestOrderValue)} color="#22c55e" />
            <StatBox icon="🏷️" label="Coupons Issued" value={fmt(data.customer.totalCouponDiscount)} sub="admin loss" color="#ef4444" />
            <StatBox icon="❌" label="Cancelled Orders" value={data.orders.cancelled} sub={`₹${data.orders.cancelledLoss} fee lost`} color="#94a3b8" />
            <StatBox icon="🔄" label="Refunds/Failed" value={`${data.orders.refundedPayments} / ${data.orders.failedPayments}`} sub="refunded / failed" color="#f59e0b" />
          </div>

          {/* 30-Day Trend */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', marginBottom: 12 }}>📈 30-Day Revenue Trend (Admin Earning)</div>
            <TrendChart data={data.trend.daily} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: '0.75rem', color: '#94a3b8' }}>
              <span>{data.trend.daily[0]?.date}</span>
              <span>{data.trend.daily[29]?.date}</span>
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Highest Day</div>
                <div style={{ fontWeight: 700, color: '#22c55e', fontSize: '0.88rem' }}>
                  {data.trend.highestRevenueDay.date} — {fmt(data.trend.highestRevenueDay.revenue)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Lowest Active Day</div>
                <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.88rem' }}>
                  {data.trend.lowestRevenueDay.date || '—'} {data.trend.lowestRevenueDay.revenue > 0 ? `— ${fmt(data.trend.lowestRevenueDay.revenue)}` : ''}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── CUSTOMER TAB ──────────────────────────────────────────────────────── */}
      {tab === 'customer' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card accent="#0ea5e9">
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#0ea5e9' }}>💳 Payment Breakdown</div>
            <Row label="Total Paid by Customers" value={fmt(data.customer.totalCustomerPaid)} bold color="#0ea5e9" />
            <Row label="Product Amount" value={fmt(data.customer.totalProductAmount)} />
            <Row label="Delivery Fees Collected" value={fmt(data.customer.totalDeliveryFee)} />
            <Row label="Platform Fees Collected" value={fmt(data.customer.totalPlatformFee)} />
            <Row label="Coupon Discounts Given" value={`− ${fmt(data.customer.totalCouponDiscount)}`} color="#ef4444" />
          </Card>
          <Card accent="#22c55e">
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#22c55e' }}>📊 Payment Methods</div>
            <Row label="Online Payments" value={fmt(data.customer.totalOnlineAmount)} sub={`${data.customer.onlinePct}% of orders`} color="#22c55e" />
            <Row label="COD Payments" value={fmt(data.customer.totalCodAmount)} sub={`${data.customer.codPct}% of orders`} />
            <Row label="Failed Payments" value={`${data.orders.failedPayments} transactions`} color="#ef4444" />
            <Row label="Refunded Payments" value={`${data.orders.refundedPayments} transactions`} color="#f59e0b" />
          </Card>
          <Card accent="#f97316">
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#f97316' }}>📦 Order Value Stats</div>
            <Row label="Average Order Value" value={fmt(data.orders.avgOrderValue)} bold />
            <Row label="Highest Order" value={fmt(data.orders.highestOrderValue)} color="#22c55e" />
            <Row label="Lowest Order" value={fmt(data.orders.lowestOrderValue)} color="#ef4444" />
            <Row label="Delivered Orders" value={`${data.orders.delivered}`} />
            <Row label="Cancelled Orders" value={`${data.orders.cancelled}`} color="#ef4444" />
          </Card>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>📋 Order Status</div>
            {Object.entries(data.orders.statusCounts).map(([status, count]) => (
              <Row key={status} label={status.replace(/_/g, ' ')} value={`${count}`} />
            ))}
          </Card>
        </div>
      )}

      {/* ── AGENT TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'agent' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card accent="#f97316">
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#f97316' }}>🛵 Delivery Earnings</div>
            <Row label="Total Delivery Earnings" value={fmt(data.agent.totalDeliveryEarnings)} bold color="#f97316" />
            <Row label="Lifetime Earnings (wallet)" value={fmt(data.agent.totalLifetimeEarnings)} />
            <Row label="Current Wallet Balance" value={fmt(data.agent.totalWalletBalance)} />
          </Card>
          <Card accent="#ef4444">
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#ef4444' }}>💵 COD Cash Handling</div>
            <Row label="COD Cash Collected" value={fmt(data.agent.totalCodCashCollected)} bold sub="full order amount in cash" />
            <Row label="Settled to Platform" value={fmt(data.agent.completedSettlements)} color="#22c55e" />
            <Row label="Pending Settlement" value={fmt(data.agent.pendingCodSettlement)} color="#ef4444" />
            <Row label="Agents with Negative Balance" value={`${data.agent.negativeBalanceAgents}`} color="#ef4444" />
          </Card>
          <Card accent="#22c55e">
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#22c55e' }}>💸 Agent Withdrawals</div>
            <Row label="Withdrawals Completed" value={fmt(data.agent.withdrawalsPaid)} color="#22c55e" />
            <Row label="Withdrawals Pending" value={fmt(data.agent.withdrawalsPending)} color="#f59e0b" />
          </Card>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>ℹ️ COD Flow Explained</div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>
              Agents collect <strong>full order amount</strong> in COD orders. Their wallet balance goes <strong>negative</strong> by that amount. They must pay it back via Razorpay settlement. Once settled, the admin receives the platform&apos;s share.
            </p>
            <p style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: 8 }}>
              <strong>⚠️ Pending: {fmt(data.agent.pendingCodSettlement)}</strong> owed by agents
            </p>
          </Card>
        </div>
      )}

      {/* ── SHOPKEEPER TAB ────────────────────────────────────────────────────── */}
      {tab === 'shopkeeper' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card accent="#a855f7">
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#a855f7' }}>🏪 Sales Analytics</div>
            <Row label="Total Product Earnings" value={fmt(data.shopkeeper.totalProductEarnings)} bold color="#a855f7" />
            <Row label="Lifetime Earnings (all shops)" value={fmt(data.shopkeeper.totalLifetimeEarnings)} />
            <Row label="Pending in Wallets" value={fmt(data.shopkeeper.totalWalletBalance)} />
            <Row label="Platform Fees Deducted" value={fmt(data.customer.totalPlatformFee)} color="#ef4444" />
          </Card>
          <Card accent="#8b5cf6">
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#8b5cf6' }}>📋 Subscriptions</div>
            <Row label="Total Subscription Revenue" value={fmt(data.shopkeeper.subscriptionRevenue)} bold color="#8b5cf6" />
            <Row label="Total Paid Subscriptions" value={`${data.shopkeeper.paidSubscriptions}`} />
            <Row label="Active (approx. last 30d)" value={`${data.shopkeeper.activeSubscriptions}`} color="#22c55e" />
            <Row label="Expired" value={`${data.shopkeeper.expiredSubscriptions}`} color="#94a3b8" />
          </Card>
          <Card accent="#22c55e">
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#22c55e' }}>💸 Withdrawals</div>
            <Row label="Paid Out" value={fmt(data.shopkeeper.withdrawalsPaid)} color="#22c55e" />
            <Row label="Pending" value={fmt(data.shopkeeper.withdrawalsPending)} color="#f59e0b" />
          </Card>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>🏆 Top Earning Shops</div>
            {data.shopkeeper.topShops.length === 0
              ? <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No data yet</p>
              : data.shopkeeper.topShops.map((s, i) => (
                <Row key={i} label={s.name} value={fmt(s.earnings)} sub={`${s.orders} orders`} />
              ))
            }
          </Card>
        </div>
      )}

      {/* ── ADMIN P&L TAB ─────────────────────────────────────────────────────── */}
      {tab === 'admin' && (
        <div>
          {/* P&L Hero */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <StatBox icon="📥" label="Gross Inflow" value={fmt(data.admin.grossInflow)} sub="customers + subs" color="#0ea5e9" />
            <StatBox icon="💎" label="Net Profit" value={fmt(data.admin.netProfit)} sub="actual admin share" color="#7c3aed" />
            <StatBox icon="📤" label="Gross Outflow" value={fmt(data.admin.grossOutflow)} sub="shops + agents + coupons" color="#64748b" />
            <StatBox icon="🔴" label="Total Losses" value={fmt(data.admin.totalLosses)} sub="coupons + cancellations" color="#ef4444" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card accent="#7c3aed">
              <div style={{ fontWeight: 700, marginBottom: 12, color: '#7c3aed' }}>💰 Revenue Streams</div>
              <Row label="Platform Fee Earnings" value={fmt(data.admin.platformFeeEarnings)} />
              <Row label="Delivery Commission (20%)" value={fmt(data.admin.deliveryCommissionEarnings)} />
              <Row label="Subscription Plan Revenue" value={fmt(data.admin.subscriptionEarnings)} />
              <div style={{ borderTop: '2px solid #e2e8f0', marginTop: 8, paddingTop: 8 }}>
                <Row label="Total Admin Revenue" value={fmt(data.admin.totalRevenue)} bold color="#7c3aed" />
              </div>
            </Card>
            <Card accent="#ef4444">
              <div style={{ fontWeight: 700, marginBottom: 12, color: '#ef4444' }}>📉 Losses / Deductions</div>
              <Row label="Coupon Discounts (cost to platform)" value={`− ${fmt(data.admin.couponCost)}`} color="#ef4444" />
              <Row label="Cancelled Order Fee Loss" value={`− ${fmt(data.admin.cancelledLoss)}`} color="#ef4444" />
              <Row label="Refunded Transactions" value={`${data.admin.refundLoss} events`} color="#f59e0b" />
              <div style={{ borderTop: '2px solid #e2e8f0', marginTop: 8, paddingTop: 8 }}>
                <Row label="Total Losses" value={`− ${fmt(data.admin.totalLosses)}`} bold color="#ef4444" />
              </div>
            </Card>
            <Card>
              <div style={{ fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>⚖️ P&L Summary</div>
              <Row label="Gross Inflow (customer + subs)" value={fmt(data.admin.grossInflow)} />
              <Row label="Gross Outflow (shops + agents)" value={`− ${fmt(data.admin.grossOutflow)}`} color="#ef4444" />
              <div style={{ borderTop: '2px solid #e2e8f0', marginTop: 8, paddingTop: 8 }}>
                <Row label="Net Revenue" value={fmt(data.admin.netRevenue)} bold color="#0ea5e9" />
                <Row label="Net Admin Profit" value={fmt(data.admin.netProfit)} bold color="#7c3aed" />
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 12 }}>
                * Admin earns ONLY platform fee + subscriptions (coupons absorbed by platform).<br />
                Coupon cost (₹{data.admin.couponCost || 0}) is reported as a marketing expense below.
              </p>
            </Card>
            <Card>
              <div style={{ fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>📊 Platform Share</div>
              <Row label="Admin share of customer spend" value={pct(data.admin.netProfit, data.customer.totalCustomerPaid)} bold />
              <Row label="Platform fee % contribution" value={pct(data.admin.platformFeeEarnings, data.admin.netProfit)} />
              <Row label="Subscription % contribution" value={pct(data.admin.subscriptionEarnings, data.admin.netProfit)} />
              <Row label="Coupon cost as % of revenue" value={pct(data.admin.couponCost, data.admin.netProfit)} color="#ef4444" />
            </Card>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
          div[style*="grid-template-columns: repeat(3"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
