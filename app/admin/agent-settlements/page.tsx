'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Transaction {
  id: string
  user_id: string
  agent_name: string
  agent_phone: string
  amount: number
  description: string
  balance_after: number
  created_at: string
  razorpay_payment_id?: string
  razorpay_order_id?: string
}

interface AgentStat {
  id: string
  name: string
  phone: string
  wallet_balance: number
  total_settled: number
  settlement_count: number
  last_settled_at: string | null
}

interface PendingAgent {
  id: string
  full_name: string
  phone: string
  wallet_balance: number
}

export default function AdminAgentSettlements() {
  const router = useRouter()
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [agentStats, setAgentStats] = useState<AgentStat[]>([])
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'transactions' | 'pending'>('overview')
  const [filterAgent, setFilterAgent] = useState('')
  const [totalSettled, setTotalSettled] = useState(0)
  const [totalPending, setTotalPending] = useState(0)

  async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch('/api/admin/agent-settlements', { headers: { ...authHeader } })
      const data = await res.json()
      if (!res.ok) { setLoading(false); return }

      setTransactions(data.transactions || [])
      setAgentStats(data.agentStats || [])
      setPendingAgents(data.pendingAgents || [])

      const total = (data.transactions || []).reduce((s: number, t: Transaction) => s + Number(t.amount), 0)
      setTotalSettled(total)

      const pending = (data.pendingAgents || []).reduce((s: number, a: PendingAgent) => s + Math.abs(a.wallet_balance), 0)
      setTotalPending(pending)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filteredTxns = filterAgent
    ? transactions.filter(t => t.agent_name.toLowerCase().includes(filterAgent.toLowerCase()) || t.agent_phone.includes(filterAgent))
    : transactions

  function formatDate(d: string) {
    return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <div>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', marginBottom: 14, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Command Center
          </button>
          <h2 style={{ marginBottom: 4 }}>💳 Agent COD Settlements</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Track Razorpay payments from agents settling their COD cash balance
          </p>
        </div>
        <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>
          🔄 Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          {
            icon: '✅',
            label: 'Total Settled',
            value: `₹${totalSettled.toFixed(0)}`,
            sub: `${transactions.length} payment${transactions.length !== 1 ? 's' : ''}`,
            color: '#22c55e',
          },
          {
            icon: '⏳',
            label: 'Pending to Settle',
            value: `₹${totalPending.toFixed(0)}`,
            sub: `${pendingAgents.length} agent${pendingAgents.length !== 1 ? 's' : ''} owe this`,
            color: '#ef4444',
          },
          {
            icon: '🛵',
            label: 'Agents with History',
            value: agentStats.length,
            sub: 'have made ≥1 settlement',
            color: '#f97316',
          },
        ].map(s => (
          <div key={s.label} style={{
            background: 'white', border: '1.5px solid var(--border)', borderRadius: 14,
            padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)'
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
              <div style={{ fontSize: '0.7rem', color: s.color, fontWeight: 700, marginTop: 2 }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {([
          { key: 'overview', label: `📊 Agent Overview (${agentStats.length})` },
          { key: 'transactions', label: `💳 All Transactions (${transactions.length})` },
          { key: 'pending', label: `⚠️ Pending (${pendingAgents.length})` },
        ] as const).map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto 16px' }} />
          Loading settlement data...
        </div>
      ) : (
        <>
          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && (
            <div>
              {agentStats.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>💳</div>
                  <p style={{ color: 'var(--text-muted)' }}>No settlements recorded yet</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th>Settlements Made</th>
                        <th>Total Settled</th>
                        <th>Current Wallet</th>
                        <th>Last Payment</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentStats.map(a => {
                        const owes = a.wallet_balance < 0
                        return (
                          <tr key={a.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{a.name}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.phone}</div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-blue">{a.settlement_count}×</span>
                            </td>
                            <td style={{ fontWeight: 700, color: '#16a34a' }}>₹{a.total_settled.toFixed(2)}</td>
                            <td>
                              <span style={{
                                fontWeight: 800, fontSize: '0.9rem',
                                color: owes ? '#dc2626' : '#16a34a'
                              }}>
                                {owes ? `−₹${Math.abs(a.wallet_balance).toFixed(2)}` : `₹${a.wallet_balance.toFixed(2)}`}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              {a.last_settled_at ? formatDate(a.last_settled_at) : '—'}
                            </td>
                            <td>
                              {owes
                                ? <span className="badge badge-red">⚠️ Owes ₹{Math.abs(a.wallet_balance).toFixed(0)}</span>
                                : <span className="badge badge-green">✅ Clear</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TRANSACTIONS TAB ── */}
          {tab === 'transactions' && (
            <div>
              {/* Search filter */}
              <div style={{ marginBottom: 16, maxWidth: 360 }}>
                <input
                  className="input"
                  placeholder="🔍 Search by agent name or phone..."
                  value={filterAgent}
                  onChange={e => setFilterAgent(e.target.value)}
                />
              </div>

              {filteredTxns.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>💳</div>
                  <p style={{ color: 'var(--text-muted)' }}>
                    {filterAgent ? 'No transactions match your search' : 'No settlement transactions yet'}
                  </p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Agent</th>
                        <th>Amount Paid</th>
                        <th>Balance After</th>
                        <th>Razorpay ID</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTxns.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatDate(t.created_at)}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{t.agent_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.agent_phone}</div>
                          </td>
                          <td style={{ fontWeight: 800, color: '#16a34a', fontSize: '1rem' }}>
                            +₹{Number(t.amount).toFixed(2)}
                          </td>
                          <td style={{ fontWeight: 700, color: t.balance_after < 0 ? '#dc2626' : '#16a34a' }}>
                            {t.balance_after < 0 ? `−₹${Math.abs(t.balance_after).toFixed(2)}` : `₹${t.balance_after.toFixed(2)}`}
                          </td>
                          <td>
                            {t.razorpay_payment_id ? (
                              <span style={{
                                fontFamily: 'monospace', fontSize: '0.75rem',
                                background: '#f0fdf4', color: '#16a34a',
                                padding: '3px 8px', borderRadius: 6, fontWeight: 700,
                                border: '1px solid #bbf7d0'
                              }}>
                                ✓ {t.razorpay_payment_id.slice(0, 16)}...
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>—</span>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-green">✅ Verified</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── PENDING TAB ── */}
          {tab === 'pending' && (
            <div>
              {pendingAgents.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
                  <p style={{ color: 'var(--success)', fontWeight: 700 }}>All agents have cleared their COD balances!</p>
                </div>
              ) : (
                <>
                  <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
                    <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>
                      ⚠️ {pendingAgents.length} agent{pendingAgents.length !== 1 ? 's' : ''} owe a total of ₹{totalPending.toFixed(2)} in COD cash
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      These agents collected cash from customers but haven&apos;t remitted it yet. They should pay via the Razorpay settlement in their Wallet page.
                    </div>
                  </div>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Agent</th>
                          <th>Amount Owed</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingAgents.map(a => (
                          <tr key={a.id}>
                            <td>
                              <div style={{ fontWeight: 700 }}>{a.full_name}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.phone}</div>
                            </td>
                            <td>
                              <span style={{ fontWeight: 900, color: '#dc2626', fontSize: '1.1rem' }}>
                                ₹{Math.abs(a.wallet_balance).toFixed(2)}
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-red">⏳ Awaiting Settlement</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
