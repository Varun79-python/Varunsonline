'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Withdrawal {
  id: string
  amount: number
  payment_method: string
  upi_id: string | null
  bank_account_number: string | null
  bank_ifsc: string | null
  status: string
  requested_at: string
  processed_at: string | null
  admin_note: string | null
  user_type: string
  user_id: string
  profiles: { full_name: string; email: string; phone: string | null } | null
}

export default function AdminWithdrawals() {
  const supabase = createClient()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  async function getAuthHeader(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  async function load() {
    setLoading(true)
    const authHeader = await getAuthHeader()
    const res = await fetch('/api/admin/withdrawals', { headers: { ...authHeader } })
    const data = await res.json()
    setWithdrawals(data.withdrawals || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function process(id: string, action: 'paid' | 'rejected') {
    let admin_note: string | null = null
    if (action === 'rejected') {
      admin_note = window.prompt('Enter rejection reason (optional):') || null
    } else {
      const confirmed = window.confirm('Have you manually transferred the money to the user\'s UPI/bank account? Click OK only after the transfer is done.')
      if (!confirmed) return
    }

    setProcessing(id)
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ id, action, admin_note })
      })
      const data = await res.json()
      if (!res.ok) { showToast(`❌ ${data.error || 'Failed'}`, false); return }

      showToast(action === 'paid' ? '✅ Marked as paid & wallet debited!' : '❌ Request rejected.')
      // Update local state
      setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: action, admin_note, processed_at: new Date().toISOString() } : w))
    } finally {
      setProcessing(null)
    }
  }

  const pending = withdrawals.filter(w => w.status === 'pending')
  const done = withdrawals.filter(w => w.status !== 'pending')

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'white',
          border: `1.5px solid ${toast.ok ? '#22c55e' : '#ef4444'}`,
          borderRadius: 10, padding: '12px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontWeight: 600, fontSize: '0.92rem'
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2>💸 Withdrawal Requests</h2>
        <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>🔄 Refresh</button>
      </div>
      <p style={{ marginBottom: 20, color: 'var(--text-muted)' }}>
        Review requests, manually transfer money to user&apos;s UPI/bank, then mark as paid.
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
      ) : (
        <>
          {/* ── Pending ── */}
          {pending.length > 0 && (
            <>
              <h3 style={{ marginBottom: 14 }}>⏳ Pending ({pending.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
                {pending.map(w => (
                  <div key={w.id} className="card" style={{ borderLeft: '4px solid #f59e0b', padding: 20 }}>
                    {/* User info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                          {w.profiles?.full_name || 'Unknown'}&nbsp;
                          <span className="badge badge-blue">{w.user_type === 'shopkeeper' ? '🏪 Shop' : '🛵 Agent'}</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>{w.profiles?.email}</div>
                        {w.profiles?.phone && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>📞 {w.profiles.phone}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 900, fontSize: '1.6rem', color: 'var(--primary)' }}>₹{w.amount}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{new Date(w.requested_at).toLocaleString('en-IN')}</div>
                      </div>
                    </div>

                    {/* Payment destination — most important info */}
                    <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#92400e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        💳 Send Money To
                      </div>
                      {w.payment_method === 'upi' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '1.3rem' }}>📱</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{w.upi_id}</div>
                            <div style={{ fontSize: '0.78rem', color: '#78350f' }}>UPI Transfer</div>
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(w.upi_id || '')}
                            style={{ marginLeft: 'auto', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                          >
                            📋 Copy
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: '#78350f', fontWeight: 600 }}>Account Number</div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{w.bank_account_number}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: '#78350f', fontWeight: 600 }}>IFSC Code</div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{w.bank_ifsc}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#78350f', marginTop: 4 }}>Bank Transfer (NEFT/IMPS)</div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        className="btn btn-success btn-sm"
                        style={{ flex: 1, opacity: processing === w.id ? 0.6 : 1 }}
                        disabled={!!processing}
                        onClick={() => process(w.id, 'paid')}
                      >
                        {processing === w.id ? '⏳ Processing...' : '✅ Mark as Paid'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={!!processing}
                        onClick={() => process(w.id, 'rejected')}
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {pending.length === 0 && !loading && (
            <div className="card" style={{ textAlign: 'center', padding: 40, marginBottom: 28 }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
              <p style={{ color: 'var(--text-muted)' }}>No pending withdrawal requests</p>
            </div>
          )}

          {/* ── History ── */}
          <h3 style={{ marginBottom: 14 }}>History</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Send To</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {done.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>No processed requests yet</td></tr>
                )}
                {done.map(w => (
                  <tr key={w.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{w.profiles?.full_name || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.profiles?.email}</div>
                    </td>
                    <td><span className="badge badge-blue">{w.user_type === 'shopkeeper' ? '🏪 Shop' : '🛵 Agent'}</span></td>
                    <td style={{ fontWeight: 700 }}>₹{w.amount}</td>
                    <td style={{ fontSize: '0.82rem' }}>
                      {w.payment_method === 'upi' ? `📱 ${w.upi_id}` : `🏦 ${w.bank_account_number}`}
                    </td>
                    <td>
                      <span className={`badge ${w.status === 'paid' ? 'badge-green' : 'badge-red'}`}>
                        {w.status === 'paid' ? '✅ Paid' : '❌ Rejected'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {new Date(w.requested_at).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
