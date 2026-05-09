'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ShopkeeperWallet() {
  const supabase = createClient()
  const [shopId, setShopId] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [txns, setTxns] = useState<Record<string, unknown>[]>([])
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [form, setForm] = useState({ amount: '', payment_method: 'upi', upi_id: '', bank_account_number: '', bank_ifsc: '' })
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase.from('shops').select('id, wallet_balance, total_earnings').eq('owner_id', user.id).single()
      if (!shop) return
      setShopId(shop.id)
      setBalance(shop.wallet_balance || 0)
      const { data: t } = await supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
      setTxns(t || [])
    }
    load()
  }, [])

  async function requestWithdraw() {
    if (Number(form.amount) > balance) { setMsg('Amount exceeds wallet balance'); return }
    if (Number(form.amount) < 100) { setMsg('Minimum withdrawal ₹100'); return }
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('withdraw_requests').insert({ user_id: user?.id, user_type: 'shopkeeper', amount: Number(form.amount), payment_method: form.payment_method, upi_id: form.upi_id, bank_account_number: form.bank_account_number, bank_ifsc: form.bank_ifsc })
    setMsg('✅ Withdrawal request submitted! Admin will process it shortly.')
    setShowWithdraw(false); setSubmitting(false)
  }

  return (
    <div className="fade-in" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(14,165,233,0.1))', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 28, textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>Available Balance</div>
        <div style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--primary)', marginBottom: 16 }}>₹{balance.toFixed(2)}</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 16 }}>Earnings credited after admin processes each order.</p>
        <button className="btn btn-primary" onClick={() => setShowWithdraw(true)} disabled={balance < 100}>Withdraw →</button>
      </div>

      {msg && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: '0.88rem', color: 'var(--success)' }}>{msg}</div>}

      {showWithdraw && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h3>💸 Request Withdrawal</h3><button className="modal-close" onClick={() => setShowWithdraw(false)}>✕</button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="input-group"><label className="input-label">Amount (₹)</label><input className="input" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder={`Max: ₹${balance.toFixed(0)}`} /></div>
              <div className="input-group"><label className="input-label">Payment Method</label>
                <select className="input" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                  <option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              {form.payment_method === 'upi'
                ? <div className="input-group"><label className="input-label">UPI ID</label><input className="input" value={form.upi_id} onChange={e => setForm(f => ({ ...f, upi_id: e.target.value }))} /></div>
                : <>
                    <div className="input-group"><label className="input-label">Account Number</label><input className="input" value={form.bank_account_number} onChange={e => setForm(f => ({ ...f, bank_account_number: e.target.value }))} /></div>
                    <div className="input-group"><label className="input-label">IFSC Code</label><input className="input" value={form.bank_ifsc} onChange={e => setForm(f => ({ ...f, bank_ifsc: e.target.value }))} /></div>
                  </>
              }
              <button className="btn btn-primary" onClick={requestWithdraw} disabled={submitting}>{submitting ? 'Submitting...' : 'Request Withdrawal'}</button>
            </div>
          </div>
        </div>
      )}

      <h3 style={{ marginBottom: 14 }}>Transaction History</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {txns.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 30 }}>No transactions yet. Earnings appear after order completion.</div>}
        {txns.map(t => (
          <div key={t.id as string} className="card-flat flex-between">
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.description as string}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{new Date(t.created_at as string).toLocaleDateString('en-IN')}</div>
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
