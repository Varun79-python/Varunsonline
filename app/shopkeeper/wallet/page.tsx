'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ShopkeeperWallet() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [txns, setTxns] = useState<Record<string, unknown>[]>([])
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
      const { data: shop } = await supabase
        .from('shops')
        .select('wallet_balance')
        .eq('owner_id', user.id)
        .single()
      if (shop) setBalance(shop.wallet_balance || 0)

      const { data: t } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)
      setTxns(t || [])

      // Check if there's already a pending withdrawal
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
          user_type: 'shopkeeper',
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
      setSuccessMsg('✅ Withdrawal request submitted! Admin will process it and transfer to your account within 24 hours.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '0 12px', maxWidth: 560, margin: '0 auto' }}>
      {/* Balance Card */}
      <div style={{
        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
        borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 20
      }}>
        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>Available Balance</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', marginBottom: 16 }}>
          ₹{balance.toFixed(2)}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
          Earnings credited after admin processes each order.
        </p>
        {hasPending ? (
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '10px 16px', fontSize: '0.8rem', color: 'white', fontWeight: 600 }}>
            ⏳ Withdrawal pending
          </div>
        ) : (
          <button onClick={() => { setFormError(''); setShowWithdraw(true) }} style={{ background: 'white', color: '#f97316', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}>
            Withdraw →
          </button>
        )}
      </div>

      {successMsg && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdraw && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && setShowWithdraw(false)}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 380 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>💸 Withdraw</h3>
              <button onClick={() => { setShowWithdraw(false); setFormError('') }} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {formError && (
                <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem', color: '#dc2626', fontWeight: 600 }}>
                  ⚠️ {formError}
                </div>
              )}
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem', color: '#64748b' }}>
                Balance: <strong style={{ color: '#f97316' }}>₹{balance.toFixed(2)}</strong>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Amount (₹)</label>
                <input type="number" min={1} max={balance} value={form.amount} onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); setFormError('') }} placeholder={`Max ₹${balance.toFixed(0)}`} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Method</label>
                <select value={form.payment_method} onChange={e => { setForm(f => ({ ...f, payment_method: e.target.value })); setFormError('') }} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }}>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              {form.payment_method === 'upi' ? (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>UPI ID</label>
                  <input value={form.upi_id} onChange={e => { setForm(f => ({ ...f, upi_id: e.target.value })); setFormError('') }} placeholder="yourname@upi" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Account Number</label>
                    <input value={form.bank_account_number} onChange={e => { setForm(f => ({ ...f, bank_account_number: e.target.value })); setFormError('') }} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>IFSC Code</label>
                    <input value={form.bank_ifsc} onChange={e => { setForm(f => ({ ...f, bank_ifsc: e.target.value })); setFormError('') }} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                  </div>
                </>
              )}
              <button onClick={requestWithdraw} disabled={submitting} style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: 10, padding: '14px', fontWeight: 700, fontSize: '0.95rem', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? '⏳ Submitting...' : '✓ Request Withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <h3 style={{ marginBottom: 14, fontSize: '1rem' }}>📜 Transactions</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {txns.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, background: '#f8fafc', borderRadius: 12 }}>No transactions yet</div>
        )}
        {txns.map(t => (
          <div key={t.id as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', borderRadius: 10, padding: 12, border: '1.5px solid #e2e8f0' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.description as string}</div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{new Date(t.created_at as string).toLocaleDateString('en-IN')}</div>
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: (t.type as string) === 'credit' ? '#16a34a' : '#dc2626' }}>
              {(t.type as string) === 'credit' ? '+' : '−'}₹{t.amount as number}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
