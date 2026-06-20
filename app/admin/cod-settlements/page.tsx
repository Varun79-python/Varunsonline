'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/modules/infrastructure/supabase/client'

interface SettlementEntry {
  id: string; agent_id: string; order_id: string
  cash_collected: number; amount_owed_to_platform: number
  settled_amount: number; pending_amount: number
  status: string; created_at: string; notes: string
  delivery_agents?: { full_name: string; phone: string; wallet_balance: number }
  orders?: { order_number: string; total_amount: number }
}

export default function AdminCodSettlements() {
  const router = useRouter()
  const supabase = createClient()
  const [entries, setEntries] = useState<SettlementEntry[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [settleAmount, setSettleAmount] = useState('')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  async function load() {
    setLoading(true)
    try {
      const authHeader = await getAuthHeader()
      const params = filterStatus ? `?status=${filterStatus}` : ''
      const headers: Record<string, string> = { ...authHeader }
      const res = await fetch(`/api/admin/cod-settlements${params}`, { headers })
      const data = await res.json()
      setEntries(data.entries || [])
      setSummary(data.summary || {})
    } catch { setMsg({ text: '❌ Failed to load', ok: false }) }
    setLoading(false)
  }

  useEffect(() => { load() }, [filterStatus])

  async function manualSettle(ledgerId: string) {
    const amt = Number(settleAmount)
    if (!amt || amt <= 0) { setMsg({ text: '❌ Enter a valid amount', ok: false }); return }
    setSettlingId(ledgerId)
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch('/api/admin/cod-settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ ledgerId, settleAmount: amt, notes: 'Manual settlement by admin' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ text: `✅ ₹${amt} settlement recorded`, ok: true })
      setSettleAmount('')
      load()
    } catch (e) { setMsg({ text: `❌ ${(e as Error).message}`, ok: false }) }
    setSettlingId(null)
  }

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <div>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', marginBottom: 14, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Command Center
          </button>
          <h2 style={{ marginBottom: 4 }}>📋 COD Settlements</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Track and manage delivery agent COD collections
          </p>
        </div>
      </div>

      {msg && (
        <div style={{
          background: msg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${msg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          color: msg.ok ? 'var(--success)' : 'var(--danger)', fontWeight: 600
        }}>{msg.text}</div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Owed</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>₹{(summary.totalOwed || 0).toFixed(2)}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pending</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#dc2626' }}>₹{(summary.totalPending || 0).toFixed(2)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{summary.pendingCount || 0} entries</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Settled</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#16a34a' }}>₹{(summary.totalSettled || 0).toFixed(2)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{summary.settledCount || 0} entries</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Partial</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f59e0b' }}>{summary.partiallyPaidCount || 0}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>entries</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', 'pending', 'partially_paid', 'settled', 'overdue'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1.5px solid var(--border)',
              background: filterStatus === s ? '#f97316' : 'white',
              color: filterStatus === s ? 'white' : '#64748b',
              fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
            }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No COD settlement entries found
            </div>
          )}
          {entries.map(e => (
            <div key={e.id} className="card" style={{
              borderLeft: `4px solid ${
                e.status === 'settled' ? '#22c55e'
                : e.status === 'partially_paid' ? '#f59e0b'
                : e.status === 'overdue' ? '#ef4444'
                : '#f97316'
              }`
            }}>
              <div className="flex-between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                <div style={{ fontWeight: 700 }}>
                  {e.delivery_agents?.full_name || 'Unknown Agent'}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.82rem' }}>
                    {e.orders?.order_number || `Order ${e.order_id?.slice(0, 8)}`}
                  </span>
                </div>
                <span className={`badge ${
                  e.status === 'settled' ? 'badge-green'
                  : e.status === 'partially_paid' ? 'badge-yellow'
                  : e.status === 'overdue' ? 'badge-red'
                  : 'badge-orange'
                }`}>
                  {e.status}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 8, fontSize: '0.85rem' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Cash:</span> <strong>₹{e.cash_collected}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Owed:</span> <strong>₹{e.amount_owed_to_platform}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Paid:</span> <strong style={{ color: '#16a34a' }}>₹{e.settled_amount}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Pending:</span> <strong style={{ color: e.pending_amount > 0 ? '#dc2626' : '#16a34a' }}>₹{e.pending_amount}</strong></div>
              </div>

              {e.delivery_agents && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  📞 {e.delivery_agents.phone} | Wallet: ₹{(e.delivery_agents.wallet_balance || 0).toFixed(2)}
                </div>
              )}

              {e.notes && (
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', marginBottom: 6 }}>
                  Note: {e.notes}
                </div>
              )}

              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {new Date(e.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>

              {/* Manual settlement form (only for non-settled entries) */}
              {e.status !== 'settled' && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="1"
                    max={e.pending_amount}
                    placeholder={`Max ₹${e.pending_amount.toFixed(2)}`}
                    value={settlingId === e.id ? settleAmount : ''}
                    onChange={e2 => setSettleAmount(e2.target.value)}
                    style={{ width: 140, padding: '6px 10px', fontSize: '0.82rem' }}
                  />
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => manualSettle(e.id)}
                    disabled={settlingId === e.id}
                    style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                  >
                    {settlingId === e.id ? '⏳' : '✅ Mark Settled'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
