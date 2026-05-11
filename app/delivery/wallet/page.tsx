'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Txn { id: string; type: string; amount: number; description: string; created_at: string }

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

  useEffect(() => {
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
        .limit(30)
      setTxns((t || []) as Txn[])

      // Check pending withdrawal
      const { data: pending } = await supabase
        .from('withdraw_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle()
      setHasPending(!!pending)
    }
    load()
  }, [])

  async function requestWithdraw() {
    setFormError('')
    const amt = Number(form.amount)

    if (!form.amount || isNaN(amt) || amt <= 0) { setFormError('Please enter a valid amount.'); return }
    if (amt > balance) { setFormError(`Amount exceeds your balance of ₹${balance.toFixed(2)}.`); return }
    if (form.payment_method === 'upi' && !form.upi_id.trim()) { setFormError('Please enter your UPI ID.'); return }
    if (form.payment_method === 'bank_transfer' && (!form.bank_account_number.trim() || !form.bank_ifsc.trim())) {
      setFormError('Please enter Account Number and IFSC Code.'); return
    }

    setSubmitting(true)
    try {
      if (!userId) { setFormError('Session expired. Please refresh.'); return }

      const res = await fetch('/api/withdraw/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="fade-in" style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Balance Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(34,197,94,0.1))',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        padding: 28, textAlign: 'center', marginBottom: 24
      }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>Available Balance</div>
        <div style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--primary)', marginBottom: 16 }}>
          ₹{balance.toFixed(2)}
        </div>
        {hasPending ? (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 16px', fontSize: '0.83rem', color: '#92400e', fontWeight: 600 }}>
            ⏳ Withdrawal request pending — admin will process shortly
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => { setFormError(''); setShowWithdraw(true) }}>
            Withdraw →
          </button>
        )}
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: '0.88rem', color: 'var(--success)', fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      {/* Withdraw Modal */}
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
                Wallet Balance: <strong style={{ color: 'var(--primary)' }}>₹{balance.toFixed(2)}</strong>
              </div>

              <div className="input-group">
                <label className="input-label">Amount (₹)</label>
                <input className="input" type="number" min={1} max={balance} value={form.amount}
                  onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); setFormError('') }}
                  placeholder={`Enter amount (max ₹${balance.toFixed(0)})`} />
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

      {/* Transactions */}
      <h3 style={{ marginBottom: 14 }}>Transaction History</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {txns.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 30 }}>No transactions yet</div>
        )}
        {txns.map(t => (
          <div key={t.id} className="card-flat flex-between">
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.description}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{new Date(t.created_at).toLocaleDateString('en-IN')}</div>
            </div>
            <span style={{ fontWeight: 800, color: t.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
              {t.type === 'credit' ? '+' : '−'}₹{t.amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
