'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Withdrawal {
  id: string; amount: number; payment_method: string; upi_id: string
  bank_account_number: string; status: string; requested_at: string; user_type: string
  profiles: { full_name: string; email: string }
}

export default function AdminWithdrawals() {
  const supabase = createClient()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('withdraw_requests').select('*, profiles(full_name, email)').order('requested_at', { ascending: false })
    setWithdrawals(data || [])
  }

  async function process(id: string, status: 'paid' | 'rejected') {
    const note = status === 'rejected' ? prompt('Rejection reason?') : null
    await supabase.from('withdraw_requests').update({ status, processed_at: new Date().toISOString(), admin_note: note }).eq('id', id)
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status } : w))
    if (status === 'paid') {
      const w = withdrawals.find(x => x.id === id)
      if (w) {
        await supabase.from('wallet_transactions').insert({ user_id: w.profiles as unknown as { id: string }, user_type: w.user_type, type: 'debit', amount: w.amount, description: 'Withdrawal processed by admin' })
        const table = w.user_type === 'shopkeeper' ? 'shops' : 'delivery_agents'
        await supabase.from(table).update({ wallet_balance: supabase.rpc('decrement', { x: w.amount }) }).eq('id', w.profiles as unknown as { id: string })
      }
    }
  }

  const pending = withdrawals.filter(w => w.status === 'pending')
  const done = withdrawals.filter(w => w.status !== 'pending')

  return (
    <div className="fade-in">
      <h2 style={{ marginBottom: 8 }}>💸 Withdrawal Requests</h2>
      <p style={{ marginBottom: 20, color: 'var(--text-muted)' }}>All money flows to admin first. Approve requests to pay out shopkeepers and agents.</p>

      {pending.length > 0 && (
        <>
          <h3 style={{ marginBottom: 14 }}>⏳ Pending ({pending.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {pending.map(w => (
              <div key={w.id} className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
                <div className="flex-between" style={{ marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{w.profiles?.full_name} <span className="badge badge-blue">{w.user_type}</span></div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{w.profiles?.email}</div>
                    <div style={{ fontSize: '0.82rem', marginTop: 4 }}>{w.payment_method === 'upi' ? `UPI: ${w.upi_id}` : `Bank: ${w.bank_account_number}`}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--primary)' }}>₹{w.amount}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{new Date(w.requested_at).toLocaleDateString('en-IN')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => process(w.id, 'paid')}>✅ Mark as Paid</button>
                  <button className="btn btn-danger btn-sm" onClick={() => process(w.id, 'rejected')}>❌ Reject</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 style={{ marginBottom: 14 }}>History</h3>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Type</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {done.map(w => (
              <tr key={w.id}>
                <td>{w.profiles?.full_name}</td>
                <td><span className="badge badge-blue">{w.user_type}</span></td>
                <td style={{ fontWeight: 700 }}>₹{w.amount}</td>
                <td>{w.payment_method}</td>
                <td><span className={`badge ${w.status === 'paid' ? 'badge-green' : 'badge-red'}`}>{w.status}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{new Date(w.requested_at).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
