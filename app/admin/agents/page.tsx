'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Agent {
  id: string; full_name: string; phone: string; email: string;
  vehicle_type: string; vehicle_number: string; license_number: string;
  is_approved: boolean; is_active: boolean;
  wallet_balance: number; total_deliveries: number; today_earnings: number;
  rejection_reason: string; created_at: string;
}

export default function AdminAgents() {
  const supabase = createClient()
  const [agents, setAgents] = useState<Agent[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Agent | null>(null)

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    let q = supabase.from('delivery_agents')
      .select('*')
      .order('created_at', { ascending: false })
    if (tab === 'pending') q = q.eq('is_approved', false)
    else if (tab === 'active') q = q.eq('is_approved', true)
    const { data } = await q
    // Also try to get email from auth if not stored
    setAgents(data || [])
    setLoading(false)
  }

  async function approve(agent: Agent) {
    await supabase.from('delivery_agents').update({ is_approved: true, is_active: true }).eq('id', agent.id)
    try {
      await supabase.from('notifications').insert({
        user_id: agent.id, title: '🎉 Application Approved!',
        body: 'You can now start accepting deliveries!', type: 'agent_approved'
      })
    } catch { /* notifications optional */ }
    load()
    setSelected(null)
  }

  async function reject(agent: Agent) {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return
    await supabase.from('delivery_agents').update({ is_approved: false, rejection_reason: reason }).eq('id', agent.id)
    load()
    setSelected(null)
  }

  async function deactivate(agent: Agent) {
    if (!confirm('Deactivate this agent?')) return
    await supabase.from('delivery_agents').update({ is_approved: false, is_active: false }).eq('id', agent.id)
    load()
    setSelected(null)
  }

  const counts = {
    pending: agents.filter(a => !a.is_approved).length,
    active: agents.filter(a => a.is_approved).length,
  }

  return (
    <div className="fade-in">
      <h2 style={{ marginBottom: 20 }}>🛵 Delivery Agents</h2>

      <div className="tabs" style={{ marginBottom: 20, maxWidth: 440 }}>
        {(['pending', 'active', 'all'] as const).map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Vehicle</th>
              <th>License No.</th>
              <th>Deliveries</th>
              <th>Wallet</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</td></tr>}
            {!loading && agents.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No agents found</td></tr>
            )}
            {agents.map(agent => (
              <tr key={agent.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{agent.full_name || '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{agent.email || ''}</div>
                </td>
                <td style={{ fontWeight: 500 }}>{agent.phone || '—'}</td>
                <td>
                  <div>{agent.vehicle_type ? agent.vehicle_type.replace(/_/g, ' ') : '—'}</div>
                  {agent.vehicle_number && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{agent.vehicle_number}</div>}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{agent.license_number || '—'}</td>
                <td>{agent.total_deliveries || 0}</td>
                <td>₹{(agent.wallet_balance || 0).toFixed(0)}</td>
                <td>
                  <span className={`badge ${agent.is_approved ? 'badge-green' : 'badge-yellow'}`}>
                    {agent.is_approved ? 'Active' : 'Pending'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setSelected(agent)}
                      style={{ fontSize: '0.78rem' }}
                    >
                      👁 View
                    </button>
                    {!agent.is_approved && (
                      <>
                        <button className="btn btn-success btn-sm" onClick={() => approve(agent)} style={{ fontSize: '0.78rem' }}>✅ Approve</button>
                        <button className="btn btn-danger btn-sm" onClick={() => reject(agent)} style={{ fontSize: '0.78rem' }}>❌ Reject</button>
                      </>
                    )}
                    {agent.is_approved && (
                      <button className="btn btn-danger btn-sm" onClick={() => deactivate(agent)} style={{ fontSize: '0.78rem' }}>🚫 Deactivate</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>🛵 Agent Details</h3>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'Full Name', value: selected.full_name },
                { label: 'Phone', value: selected.phone },
                { label: 'Email', value: selected.email },
                { label: 'Vehicle Type', value: selected.vehicle_type },
                { label: 'Vehicle Number', value: selected.vehicle_number },
                { label: 'License Number', value: selected.license_number },
                { label: 'Total Deliveries', value: selected.total_deliveries || 0 },
                { label: 'Wallet Balance', value: `₹${(selected.wallet_balance || 0).toFixed(0)}` },
                { label: "Today's Earnings", value: `₹${(selected.today_earnings || 0).toFixed(0)}` },
                { label: 'Registered On', value: new Date(selected.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
              ].map(f => (
                <div key={f.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{f.value || '—'}</div>
                </div>
              ))}
            </div>

            {selected.rejection_reason && (
              <div style={{ background: 'var(--danger-light)', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: 'var(--danger)' }}>
                ❌ Rejection Reason: {selected.rejection_reason}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              {!selected.is_approved && (
                <>
                  <button className="btn btn-success" onClick={() => approve(selected)}>✅ Approve Agent</button>
                  <button className="btn btn-danger" onClick={() => reject(selected)}>❌ Reject</button>
                </>
              )}
              {selected.is_approved && (
                <button className="btn btn-danger" onClick={() => deactivate(selected)}>🚫 Deactivate Agent</button>
              )}
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
