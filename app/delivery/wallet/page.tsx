'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Txn { id: string; type: string; amount: number; description: string; created_at: string; razorpay_payment_id?: string }


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
  const [txns, setTxns] = useState<Txn[]>([])
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [form, setForm] = useState({ amount: '', payment_method: 'upi', upi_id: '', bank_account_number: '', bank_ifsc: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [hasPending, setHasPending] = useState(false)
  const [settling, setSettling] = useState(false)
  const [settleError, setSettleError] = useState('')

  const pendingBalance = balance < 0 ? Math.abs(balance) : 0
  const availableBalance = balance > 0 ? balance : 0

  async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: ag } = await supabase
      .from('delivery_agents')
      .select('wallet_balance')
      .eq('id', user.id)
      .single()
    setBalance(ag?.wallet_balance || 0)

    const { data: t } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setTxns((t || []) as Txn[])

    const { data: pending } = await supabase
      .from('withdraw_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()
    setHasPending(!!pending)
  }

  useEffect(() => { load() }, [supabase])

  // ── Razorpay settlement payment ──────────────────────────────────────────
  async function payCodSettlement() {
    if (!userId || pendingBalance <= 0 || settling) return
    setSettling(true)
    setSettleError('')

    try {
      const loaded = await loadRazorpayScript()
      if (!loaded) { setSettleError('Failed to load payment gateway. Check your internet connection.'); return }

      const authHeader = await getAuthHeader()
      // Create Razorpay order via server
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

      // Open Razorpay checkout
      interface RazorpayInstance { open(): void; on(event: string, handler: (resp: { error: { description: string } }) => void): void }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const RazorpayClass: new (opts: any) => RazorpayInstance = window.Razorpay as any
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
          // Verify payment server-side
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
            await load() // Refresh balance + transactions
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
    if (amt > availableBalance) { setFormError(`Amount exceeds your available balance of ₹${availableBalance.toFixed(2)}.`); return }
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

      {/* ── Pending COD Balance Alert ── */}
      {pendingBalance > 0 && (
        <div className="dl-cod-alert">
          <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '0.95rem', marginBottom: 4 }}>⚠️ COD Amount Owed</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#dc2626', marginBottom: 8 }}>₹{pendingBalance.toFixed(2)}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 12 }}>
            Collect cash from customers and remit to platform
          </div>
          {settleError && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', color: '#dc2626', fontWeight: 600, marginBottom: 10 }}>
              ❌ {settleError}
            </div>
          )}
          <button onClick={payCodSettlement} disabled={settling} className="dl-settle-btn">
            {settling ? '⏳ Opening...' : `💳 Pay ₹${pendingBalance.toFixed(2)}`}
          </button>
        </div>
      )}

      {/* ── Wallet Summary Card ── */}
      <div className="dl-wallet-card">
        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Available Balance</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', marginBottom: 16 }}>₹{availableBalance.toFixed(2)}</div>
        
        {pendingBalance > 0 ? (
          <div style={{ background: 'rgba(252,165,165,0.2)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', color: '#fca5a5', fontWeight: 600 }}>
            ⚠️ Clear COD debt to withdraw
          </div>
        ) : hasPending ? (
          <div style={{ background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', color: '#fbbf24', fontWeight: 600 }}>
            ⏳ Withdrawal pending...
          </div>
        ) : availableBalance > 0 ? (
          <button className="dl-withdraw-btn" onClick={() => { setFormError(''); setShowWithdraw(true) }}>
            💰 Withdraw
          </button>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
            Complete deliveries to earn
          </div>
        )}
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
          {successMsg}
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
                Available: <strong style={{ color: '#f97316' }}>₹{availableBalance.toFixed(2)}</strong>
              </div>
              <div className="input-group">
                <label className="input-label">Amount (₹)</label>
                <input className="input" type="number" min={1} max={availableBalance} value={form.amount}
                  onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); setFormError('') }}
                  placeholder={`Max ₹${availableBalance.toFixed(0)}`} />
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
