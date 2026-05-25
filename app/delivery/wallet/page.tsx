'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Txn {
  id: string; type: string; amount: number; description: string
  created_at: string; razorpay_payment_id?: string
}

interface SettlementEntry {
  id: string; order_id: string; cash_collected: number
  amount_owed_to_platform: number; settled_amount: number
  pending_amount: number; status: string; created_at: string
  orders?: { order_number: string }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (document.getElementById('rzp-script')) { resolve(true); return }
    const s = document.createElement('script')
    s.id = 'rzp-script'
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export default function DeliveryWallet() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [pendingCodDue, setPendingCodDue] = useState(0)
  const [txns, setTxns] = useState<Txn[]>([])
  const [settlements, setSettlements] = useState<SettlementEntry[]>([])
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [form, setForm] = useState({ amount: '', payment_method: 'upi', upi_id: '', bank_account_number: '', bank_ifsc: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [hasPending, setHasPending] = useState(false)
  const [settling, setSettling] = useState(false)
  const [settleError, setSettleError] = useState('')
  const [activeTab, setActiveTab] = useState<'wallet' | 'settlement'>('wallet')

  const pendingBalance = pendingCodDue // Total pending COD dues
  const withdrawableBalance = Math.max(0, balance - pendingCodDue)

  async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: ag } = await supabase
      .from('delivery_agents')
      .select('wallet_balance, pending_cod_due')
      .eq('id', user.id)
      .single()
    setBalance(ag?.wallet_balance || 0)
    setPendingCodDue(ag?.pending_cod_due || 0)

    // Load transactions
    const { data: t } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setTxns((t || []) as Txn[])

    // Load COD settlement ledger
    const { data: s } = await supabase
      .from('agent_cod_settlement_ledger')
      .select('*, orders!order_id(order_number)')
      .eq('agent_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setSettlements((s || []) as unknown as SettlementEntry[])

    // Check for pending withdrawal
    const { data: pending } = await supabase
      .from('withdraw_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()
    setHasPending(!!pending)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // ── Razorpay settlement payment ──────────────────────────────────────────
  async function payCodSettlement() {
    if (!userId || pendingBalance <= 0 || settling) return
    setSettling(true)
    setSettleError('')

    try {
      const loaded = await loadRazorpayScript()
      if (!loaded) { setSettleError('Failed to load payment gateway. Check your internet connection.'); return }

      const authHeader = await getAuthHeader()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authHeader.Authorization) headers.Authorization = authHeader.Authorization
      const res = await fetch('/api/delivery/settlement/create-order', {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount: pendingBalance })
      })
      const orderData = await res.json()
      if (!res.ok) { setSettleError(orderData.error || 'Failed to initiate payment'); return }

      const { id: order_id, amount, currency, key_id, settleAmount } = orderData

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const RazorpayClass: new (opts: any) => any = (window as any).Razorpay
      const rzp = new RazorpayClass({
        key: key_id,
        amount,
        currency,
        order_id,
        name: "Varun's Online",
        description: `COD Settlement — ₹${settleAmount?.toFixed(2)}`,
        prefill: {},
        theme: { color: '#f97316' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const authHeader = await getAuthHeader()
          const verifyHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
          if (authHeader.Authorization) verifyHeaders.Authorization = authHeader.Authorization
          const verifyRes = await fetch('/api/delivery/settlement/verify', {
            method: 'POST',
            headers: verifyHeaders,
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              settleAmount
            })
          })
          const verifyData = await verifyRes.json()
          if (verifyData.success) {
            setSuccessMsg(`✅ ${verifyData.message}`)
            await load()
          } else {
            setSettleError(verifyData.error || 'Payment verification failed. Contact support.')
          }
          setSettling(false)
        },
        modal: {
          ondismiss: () => { setSettling(false) }
        }
      })

      rzp.on('payment.failed', (response: { error: { description: string } }) => {
        setSettleError(`Payment failed: ${response.error?.description || 'Unknown error'}`)
        setSettling(false)
      })

      rzp.open()
    } catch (err) {
      console.error('Settlement error:', err)
      setSettleError('An unexpected error occurred. Please try again.')
      setSettling(false)
    }
  }

  async function requestWithdraw() {
    setFormError('')
    const amt = Number(form.amount)

    if (!form.amount || isNaN(amt) || amt <= 0) { setFormError('Please enter a valid amount.'); return }
    if (amt > withdrawableBalance) {
      const msg = pendingCodDue > 0
        ? `Amount exceeds withdrawable balance of ₹${withdrawableBalance.toFixed(2)} (₹${pendingCodDue.toFixed(2)} held for COD settlement)`
        : `Amount exceeds your available balance of ₹${withdrawableBalance.toFixed(2)}.`
      setFormError(msg)
      return
    }
    if (form.payment_method === 'upi' && !form.upi_id.trim()) { setFormError('Please enter your UPI ID.'); return }
    if (form.payment_method === 'bank_transfer' && (!form.bank_account_number.trim() || !form.bank_ifsc.trim())) {
      setFormError('Please enter Account Number and IFSC Code.'); return
    }

    setSubmitting(true)
    try {
      if (!userId) { setFormError('Session expired. Please refresh.'); return }

      const authHeader = await getAuthHeader()
      const withdrawHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authHeader.Authorization) withdrawHeaders.Authorization = authHeader.Authorization
      const res = await fetch('/api/withdraw/request', {
        method: 'POST',
        headers: withdrawHeaders,
        body: JSON.stringify({
          user_id: userId,
          user_type: 'delivery_agent',
          amount: amt,
          payment_method: form.payment_method,
          upi_id: form.payment_method === 'upi' ? form.upi_id.trim() : null,
          bank_account_number: form.payment_method === 'bank_transfer' ? form.bank_account_number.trim() : null,
          bank_ifsc: form.payment_method === 'bank_transfer' ? form.bank_ifsc.trim() : null,
        })
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error || 'Failed to submit. Please try again.'); return }

      setShowWithdraw(false)
      setForm({ amount: '', payment_method: 'upi', upi_id: '', bank_account_number: '', bank_ifsc: '' })
      setHasPending(true)
      setSuccessMsg('✅ Withdrawal request submitted! Admin will transfer to your account within 24 hours.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fade-in" style={{ maxWidth: 560, margin: '0 auto', padding: '0 12px' }}>

      {/* ── Tab Navigation ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--border)' }}>
        <button onClick={() => setActiveTab('wallet')}
          style={{
            flex: 1, padding: '10px', fontWeight: 700, fontSize: '0.85rem',
            background: activeTab === 'wallet' ? '#f97316' : 'white',
            color: activeTab === 'wallet' ? 'white' : '#64748b',
            border: 'none', cursor: 'pointer'
          }}>
          💰 Wallet
        </button>
        <button onClick={() => setActiveTab('settlement')}
          style={{
            flex: 1, padding: '10px', fontWeight: 700, fontSize: '0.85rem',
            background: activeTab === 'settlement' ? '#f97316' : 'white',
            color: activeTab === 'settlement' ? 'white' : '#64748b',
            border: 'none', cursor: 'pointer'
          }}>
          📋 COD Settlement
        </button>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 1: WALLET
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'wallet' && (
        <>
          {/* ── Wallet Summary Card ── */}
          <div className="dl-wallet-card">
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Available Balance</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', marginBottom: 4 }}>₹{balance.toFixed(2)}</div>

            {pendingCodDue > 0 && (
              <div style={{ fontSize: '0.78rem', color: '#fca5a5', marginBottom: 12 }}>
                ⏳ {pendingCodDue.toFixed(2)} held for COD settlement
              </div>
            )}

            <div style={{
              background: 'rgba(255,255,255,0.1)', borderRadius: 8,
              padding: '8px 14px', marginBottom: 14,
              display: 'flex', justifyContent: 'space-between',
              fontSize: '0.82rem'
            }}>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>Withdrawable</span>
              <span style={{ fontWeight: 800, color: '#22c55e' }}>₹{withdrawableBalance.toFixed(2)}</span>
            </div>

            {pendingCodDue > 0 ? (
              <div style={{ background: 'rgba(252,165,165,0.2)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', color: '#fca5a5', fontWeight: 600 }}>
                ⚠️ Clear COD debt to withdraw full balance
              </div>
            ) : hasPending ? (
              <div style={{ background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', color: '#fbbf24', fontWeight: 600 }}>
                ⏳ Withdrawal pending...
              </div>
            ) : withdrawableBalance > 0 ? (
              <button className="dl-withdraw-btn" onClick={() => { setFormError(''); setShowWithdraw(true) }}>
                💰 Withdraw
              </button>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                Complete deliveries to earn
              </div>
            )}
          </div>

          {/* ── COD Due Alert ── */}
          {pendingCodDue > 0 && (
            <div className="dl-cod-alert">
              <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '0.95rem', marginBottom: 4 }}>⚠️ COD Settlement Due</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#dc2626', marginBottom: 8 }}>₹{pendingCodDue.toFixed(2)}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 8 }}>
                Auto-recovering from future delivery earnings. Or pay manually below.
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 12 }}>
                Auto-recovery: your next delivery earnings will be used to clear this debt.
              </div>
              {settleError && (
                <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', color: '#dc2626', fontWeight: 600, marginBottom: 10 }}>
                  ❌ {settleError}
                </div>
              )}
              <button onClick={payCodSettlement} disabled={settling} className="dl-settle-btn">
                {settling ? '⏳ Opening...' : `💳 Pay ₹${pendingCodDue.toFixed(2)} via UPI`}
              </button>
            </div>
          )}

          {/* ── Withdraw Modal ── */}
          {showWithdraw && (
            <div className="modal-overlay">
              <div className="modal">
                <div className="modal-header">
                  <h3>💸 Withdraw Funds</h3>
                  <button className="modal-close" onClick={() => { setShowWithdraw(false); setFormError('') }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {formError && (
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>
                      ⚠️ {formError}
                    </div>
                  )}
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 14px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Balance: <strong>₹{balance.toFixed(2)}</strong>
                    {pendingCodDue > 0 && <span> | Held: <strong style={{ color: '#dc2626' }}>₹{pendingCodDue.toFixed(2)}</strong></span>}
                    &nbsp;| Withdrawable: <strong style={{ color: '#f97316' }}>₹{withdrawableBalance.toFixed(2)}</strong>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Amount (₹)</label>
                    <input className="input" type="number" min={1} max={withdrawableBalance} value={form.amount}
                      onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); setFormError('') }}
                      placeholder={`Max ₹${withdrawableBalance.toFixed(0)}`} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Payment Method</label>
                    <select className="input" value={form.payment_method}
                      onChange={e => { setForm(f => ({ ...f, payment_method: e.target.value })); setFormError('') }}>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>
                  {form.payment_method === 'upi' ? (
                    <div className="input-group">
                      <label className="input-label">UPI ID</label>
                      <input className="input" value={form.upi_id}
                        onChange={e => { setForm(f => ({ ...f, upi_id: e.target.value })); setFormError('') }}
                        placeholder="yourname@upi" />
                    </div>
                  ) : (
                    <>
                      <div className="input-group">
                        <label className="input-label">Account Number</label>
                        <input className="input" value={form.bank_account_number}
                          onChange={e => { setForm(f => ({ ...f, bank_account_number: e.target.value })); setFormError('') }} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">IFSC Code</label>
                        <input className="input" value={form.bank_ifsc}
                          onChange={e => { setForm(f => ({ ...f, bank_ifsc: e.target.value })); setFormError('') }} />
                      </div>
                    </>
                  )}
                  <button className="btn btn-primary" onClick={requestWithdraw} disabled={submitting} style={{ marginTop: 4 }}>
                    {submitting ? '⏳ Submitting...' : '✅ Request Withdrawal'}
                  </button>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Max 5 withdrawals/week (resets Monday 12 AM)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Transaction History ── */}
          <h3 style={{ marginBottom: 12, fontSize: '1.1rem' }}>📊 Transactions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {txns.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: 24 }}>No transactions yet</div>
            )}
            {txns.map(t => (
              <div key={t.id} className="dl-txn-card">
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.description}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>
                    {new Date(t.created_at).toLocaleDateString('en-IN')}
                    {t.razorpay_payment_id && (
                      <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 600 }}>✓ Verified</span>
                    )}
                  </div>
                </div>
                <span style={{
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  color: t.type === 'credit' || t.type === 'settlement' ? '#16a34a' : '#dc2626'
                }}>
                  {t.type === 'credit' || t.type === 'settlement' ? '+' : '−'}₹{Math.abs(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 2: COD SETTLEMENT
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'settlement' && (
        <div>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Total Cash Collected</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1e293b' }}>
                ₹{settlements.reduce((s, e) => s + Number(e.cash_collected || 0), 0).toFixed(2)}
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Owed to Platform</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#dc2626' }}>
                ₹{settlements.reduce((s, e) => s + Number(e.amount_owed_to_platform || 0), 0).toFixed(2)}
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Settled</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#16a34a' }}>
                ₹{settlements.reduce((s, e) => s + Number(e.settled_amount || 0), 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Pending dues alert */}
          {pendingCodDue > 0 && (
            <div style={{
              background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10,
              padding: '14px 16px', marginBottom: 16
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>🔄 Auto-Recovery Active</div>
              <div style={{ fontSize: '0.82rem', color: '#92400e', marginBottom: 6 }}>
                Pending COD Settlement: <strong>₹{pendingCodDue.toFixed(2)}</strong>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#92400e', lineHeight: 1.5 }}>
                🔄 Auto-recovery active: your future delivery earnings will be deducted until this balance reaches ₹0.<br />
                💡 Example: earn ₹20 → ₹20 recovered → ₹0 wallet credit (until debt cleared).<br />
                ✅ Once COD Due = ₹0, wallet credit resumes normally.
              </div>
            </div>
          )}

          {/* Settlement ledger */}
          <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>📋 Settlement History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {settlements.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                No COD settlement entries yet
              </div>
            )}
            {settlements.map(s => (
              <div key={s.id} className="card" style={{
                borderLeft: `4px solid ${
                  s.status === 'settled' ? '#22c55e'
                  : s.status === 'partially_paid' ? '#f59e0b'
                  : '#ef4444'
                }`
              }}>
                <div className="flex-between" style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>
                    {s.orders?.order_number || `Order ${s.order_id?.slice(0, 8)}`}
                  </span>
                  <span className={`badge ${
                    s.status === 'settled' ? 'badge-green'
                    : s.status === 'partially_paid' ? 'badge-yellow'
                    : 'badge-red'
                  }`}>
                    {s.status === 'settled' ? '✅ Settled'
                      : s.status === 'partially_paid' ? '⏳ Partial'
                      : '🔴 Pending'}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cash: ₹{s.cash_collected}</span>
                  <span>Owed: ₹{s.amount_owed_to_platform}</span>
                  <span>Paid: ₹{s.settled_amount}</span>
                  <span style={{ fontWeight: 700, color: s.pending_amount > 0 ? '#dc2626' : '#16a34a' }}>
                    Pending: ₹{s.pending_amount}
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4 }}>
                  {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>

          {/* Withdrawal requests section */}
          <h3 style={{ marginTop: 20, marginBottom: 12, fontSize: '1rem' }}>📤 Withdrawal Requests</h3>
          <WithdrawalRequests userId={userId || ''} supabase={supabase} />
        </div>
      )}

      <style>{`
        .dl-cod-alert { background: #fef2f2; border: 2px solid #fca5a5; border-radius: 14px; padding: 16px; margin-bottom: 16px; }
        .dl-settle-btn { width: 100%; padding: 12px; background: #dc2626; color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 0.9rem; }
        .dl-wallet-card { background: linear-gradient(135deg, #0f172a, #1e293b); border-radius: 16px; padding: 20px; margin-bottom: 16px; text-align: center; }
        .dl-withdraw-btn { background: #22c55e; color: white; border: none; border-radius: 10px; padding: 10px 24px; font-weight: 700; cursor: pointer; }
        .dl-txn-card { background: white; border: 1.5px solid var(--border); border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; }
      `}</style>
    </div>
  )
}

/** Sub-component to show withdrawal request history */
function WithdrawalRequests({ userId, supabase }: { userId: string; supabase: ReturnType<typeof createClient> }) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('withdraw_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then((result: { data: any[] | null }) => {
        const { data } = result
        setRequests((data || []) as any[])
        setLoading(false)
      })
  }, [userId, supabase])

  if (loading) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading...</div>
  if (requests.length === 0) return <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No withdrawal requests</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {requests.map(r => (
        <div key={r.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              ₹{r.amount} — {r.payment_method === 'upi' ? r.upi_id : 'Bank Transfer'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>
              {new Date(r.created_at).toLocaleDateString('en-IN')}
            </div>
          </div>
          <span className={`badge ${
            r.status === 'paid' ? 'badge-green'
            : r.status === 'approved' ? 'badge-blue'
            : r.status === 'rejected' ? 'badge-red'
            : 'badge-yellow'
          }`}>
            {r.status}
          </span>
        </div>
      ))}
    </div>
  )
}
