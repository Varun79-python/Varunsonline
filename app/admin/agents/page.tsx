'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Agent {
  id: string
  full_name: string; phone: string; email: string
  vehicle_type: string; vehicle_number: string; license_number: string
  license_url: string; aadhar_url: string; live_photo_url: string
  pan_url: string; vehicle_rc_url: string
  is_approved: boolean; is_active: boolean; is_available: boolean
  wallet_balance: number; total_deliveries: number; today_earnings: number
  rejection_reason: string; upi_id: string; created_at: string
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
    const { data, error } = await q
    if (error) console.error('Agents load error:', error)
    setAgents(data || [])
    setLoading(false)
  }

  async function approve(agent: Agent) {
    await supabase.from('delivery_agents')
      .update({ is_approved: true, is_active: true })
      .eq('id', agent.id)
    try {
      await supabase.from('notifications').insert({
        user_id: agent.id,
        title: '🎉 Application Approved!',
        body: 'You can now start accepting deliveries on Varun\'s Online!',
        type: 'agent_approved'
      })
    } catch { /* notifications optional */ }
    load()
    setSelected(null)
  }

  async function reject(agent: Agent) {
    const reason = prompt('Enter rejection reason (shown to agent):')
    if (!reason) return
    await supabase.from('delivery_agents')
      .update({ is_approved: false, rejection_reason: reason })
      .eq('id', agent.id)
    load()
    setSelected(null)
  }

  async function deactivate(agent: Agent) {
    if (!confirm(`Deactivate ${agent.full_name || 'this agent'}?`)) return
    await supabase.from('delivery_agents')
      .update({ is_approved: false, is_active: false })
      .eq('id', agent.id)
    load()
    setSelected(null)
  }

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <h2>🛵 Delivery Agents</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {agents.length} agent{agents.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="tabs" style={{ marginBottom: 20, maxWidth: 380 }}>
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
              <th>Name &amp; Contact</th>
              <th>Vehicle</th>
              <th>License No.</th>
              <th>Deliveries</th>
              <th>Wallet</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                Loading agents...
              </td></tr>
            )}
            {!loading && agents.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                No {tab === 'all' ? '' : tab} agents found
              </td></tr>
            )}
            {agents.map(agent => (
              <tr key={agent.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{agent.full_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No name</span>}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{agent.phone || '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{agent.email || '—'}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{agent.vehicle_type || '—'}</div>
                  {agent.vehicle_number && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{agent.vehicle_number}</div>}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                  {agent.license_number || '—'}
                </td>
                <td>{agent.total_deliveries || 0}</td>
                <td>₹{(agent.wallet_balance || 0).toFixed(0)}</td>
                <td>
                  <span className={`badge ${agent.is_approved ? 'badge-green' : 'badge-yellow'}`}>
                    {agent.is_approved ? '✓ Active' : '⏳ Pending'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setSelected(agent)}>
                      👁 View
                    </button>
                    {!agent.is_approved && <>
                      <button className="btn btn-success btn-sm" onClick={() => approve(agent)}>✅ Approve</button>
                      <button className="btn btn-danger btn-sm" onClick={() => reject(agent)}>❌ Reject</button>
                    </>}
                    {agent.is_approved && (
                      <button className="btn btn-danger btn-sm" onClick={() => deactivate(agent)}>🚫 Deactivate</button>
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
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>🛵 Agent Details</h3>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Full Name', value: selected.full_name },
                { label: 'Phone', value: selected.phone },
                { label: 'Email', value: selected.email },
                { label: 'Vehicle Type', value: selected.vehicle_type },
                { label: 'Vehicle Number', value: selected.vehicle_number },
                { label: 'License Number', value: selected.license_number },
                { label: 'UPI ID', value: selected.upi_id },
                { label: 'Wallet Balance', value: `₹${(selected.wallet_balance || 0).toFixed(0)}` },
                { label: "Today's Earnings", value: `₹${(selected.today_earnings || 0).toFixed(0)}` },
                { label: 'Total Deliveries', value: String(selected.total_deliveries || 0) },
                { label: 'Availability', value: selected.is_available ? '🟢 Online' : '🔴 Offline' },
                { label: 'Registered On', value: new Date(selected.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
              ].map(f => (
                <div key={f.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{f.label}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{f.value || '—'}</div>
                </div>
              ))}
            </div>

            {/* Document Viewer — all uploaded docs */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 10 }}>📄 Uploaded Documents</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Aadhaar Card', url: selected.aadhar_url, icon: '🪪' },
                  { label: 'Driving License', url: selected.license_url, icon: '🪪' },
                  { label: 'Live Selfie', url: selected.live_photo_url, icon: '🤳' },
                  { label: 'PAN Card', url: selected.pan_url, icon: '📋' },
                  { label: 'Vehicle RC', url: selected.vehicle_rc_url, icon: '🏍️' },
                ].map(doc => (
                  <div key={doc.label} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg)' }}>
                    {doc.url ? (
                      <a href={doc.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                        <img src={doc.url} alt={doc.label} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        <div style={{ padding: '6px 8px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--success)', textAlign: 'center' }}>
                          {doc.icon} {doc.label} ↗
                        </div>
                      </a>
                    ) : (
                      <div style={{ height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        <span style={{ fontSize: '1.5rem', marginBottom: 4 }}>—</span>
                        {doc.label}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>


            {selected.rejection_reason && (
              <div style={{ background: 'var(--danger-light)', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: 'var(--danger)' }}>
                ❌ Rejection Reason: {selected.rejection_reason}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {!selected.is_approved && <>
                <button className="btn btn-success" onClick={() => approve(selected)}>✅ Approve Agent</button>
                <button className="btn btn-danger" onClick={() => reject(selected)}>❌ Reject</button>
              </>}
              {selected.is_approved && (
                <button className="btn btn-danger" onClick={() => deactivate(selected)}>🚫 Deactivate</button>
              )}
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
