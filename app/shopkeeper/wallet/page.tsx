'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ShopkeeperWallet() {
  const supabase = createClient()
  const [balance, setBalance] = useState(0)
  const [txns, setTxns] = useState<Record<string, unknown>[]>([])
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [form, setForm] = useState({ amount: '', payment_method: 'upi', upi_id: '', bank_account_number: '', bank_ifsc: '' })
  const [submitting, setSubmitting] = useState(false)
  // Separate: inline error inside modal, success message outside modal
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase
        .from('shops')
        .select('id, wallet_balance, total_earnings')
        .eq('owner_id', user.id)
        .single()
      if (!shop) return
      setBalance(shop.wallet_balance || 0)
      const { data: t } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)
      setTxns(t || [])
    }
    load()
  }, [])

  async function requestWithdraw() {
    setFormError('')
    const amt = Number(form.amount)

    // --- Validation (shown inside the modal) ---
    if (!form.amount || isNaN(amt) || amt <= 0) {
      setFormError('Please enter a valid amount.')
      return
    }
    if (amt < 100) {
      setFormError('Minimum withdrawal amount is ₹100.')
      return
    }
    if (amt > balance) {
      setFormError(`Amount exceeds your wallet balance of ₹${balance.toFixed(2)}.`)
      return
    }
    if (form.payment_method === 'upi' && !form.upi_id.trim()) {
      setFormError('Please enter your UPI ID.')
      return
    }
    if (form.payment_method === 'bank_transfer' && (!form.bank_account_number.trim() || !form.bank_ifsc.trim())) {
      setFormError('Please enter your bank account number and IFSC code.')
      return
    }

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setFormError('Session expired. Please refresh.'); return }

      const { error } = await supabase.from('withdraw_requests').insert({
        user_id: user.id,
        user_type: 'shopkeeper',
        amount: amt,
        payment_method: form.payment_method,
        upi_id: form.payment_method === 'upi' ? form.upi_id.trim() : null,
        bank_account_number: form.payment_method === 'bank_transfer' ? form.bank_account_number.trim() : null,
        bank_ifsc: form.payment_method === 'bank_transfer' ? form.bank_ifsc.trim() : null,
      })

      if (error) {
        setFormError(`Failed to submit: ${error.message}`)
        return
      }

      // Success
      setShowWithdraw(false)
      setForm({ amount: '', payment_method: 'upi', upi_id: '', bank_account_number: '', bank_ifsc: '' })
      setSuccessMsg('✅ Withdrawal request submitted! Admin will process it within 24 hours.')
    } finally {
      setSubmitting(false)
    }
  }

  function openWithdraw() {
    setFormError('')
    setShowWithdraw(true)
  }

  return (
    <div className="fade-in" style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Balance Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(14,165,233,0.1))',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        padding: 28, textAlign: 'center', marginBottom: 24
      }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>Available Balance</div>
        <div style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--primary)', marginBottom: 16 }}>
          ₹{balance.toFixed(2)}
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 16 }}>
          Earnings credited after admin processes each order.
        </p>
        <button className="btn btn-primary" onClick={openWithdraw}>
          Withdraw →
        </button>
      </div>

      {/* Success message (shown outside modal after submission) */}
      {successMsg && (
        <div style={{
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 8, padding: 12, marginBottom: 16, fontSize: '0.88rem', color: 'var(--success)'
        }}>
          {successMsg}
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdraw && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>💸 Request Withdrawal</h3>
              <button className="modal-close" onClick={() => { setShowWithdraw(false); setFormError('') }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Inline error — INSIDE the modal so it's visible */}
              {formError && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem',
                  color: '#dc2626', fontWeight: 600
                }}>
                  ⚠️ {formError}
                </div>
              )}

              <div style={{
                background: '#f8fafc', borderRadius: 8, padding: '8px 14px',
                fontSize: '0.82rem', color: 'var(--text-muted)'
              }}>
                Wallet Balance: <strong style={{ color: 'var(--primary)' }}>₹{balance.toFixed(2)}</strong>
                &nbsp;·&nbsp; Min. withdrawal: <strong>₹100</strong>
              </div>

              <div className="input-group">
                <label className="input-label">Amount (₹)</label>
                <input
                  className="input"
                  type="number"
                  min={100}
                  max={balance}
                  value={form.amount}
                  onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); setFormError('') }}
                  placeholder={`Enter amount (max ₹${balance.toFixed(0)})`}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Payment Method</label>
                <select
                  className="input"
                  value={form.payment_method}
                  onChange={e => { setForm(f => ({ ...f, payment_method: e.target.value })); setFormError('') }}
                >
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              {form.payment_method === 'upi' ? (
                <div className="input-group">
                  <label className="input-label">UPI ID</label>
                  <input
                    className="input"
                    value={form.upi_id}
                    onChange={e => { setForm(f => ({ ...f, upi_id: e.target.value })); setFormError('') }}
                    placeholder="yourname@upi"
                  />
                </div>
              ) : (
                <>
                  <div className="input-group">
                    <label className="input-label">Account Number</label>
                    <input
                      className="input"
                      value={form.bank_account_number}
                      onChange={e => { setForm(f => ({ ...f, bank_account_number: e.target.value })); setFormError('') }}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">IFSC Code</label>
                    <input
                      className="input"
                      value={form.bank_ifsc}
                      onChange={e => { setForm(f => ({ ...f, bank_ifsc: e.target.value })); setFormError('') }}
                    />
                  </div>
                </>
              )}

              <button
                className="btn btn-primary"
                onClick={requestWithdraw}
                disabled={submitting}
                style={{ marginTop: 4 }}
              >
                {submitting ? '⏳ Submitting...' : '✅ Request Withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <h3 style={{ marginBottom: 14 }}>Transaction History</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {txns.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 30 }}>
            No transactions yet. Earnings appear after order completion.
          </div>
        )}
        {txns.map(t => (
          <div key={t.id as string} className="card-flat flex-between">
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.description as string}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                {new Date(t.created_at as string).toLocaleDateString('en-IN')}
              </div>
            </div>
            <span style={{ fontWeight: 800, color: (t.type as string) === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
              {(t.type as string) === 'credit' ? '+' : '−'}₹{t.amount as number}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
