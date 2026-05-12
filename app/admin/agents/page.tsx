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
  rejection_reason: string | null; upi_id: string; created_at: string
  terms_agreed: boolean
}

export default function AdminAgents() {
  const supabase = createClient()
  const [agents, setAgents] = useState<Agent[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Agent | null>(null)
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    // Fetch all agents at once and filter client-side to avoid TS type depth errors
    const { data } = await supabase
      .from('delivery_agents')
      .select('*')
      .order('created_at', { ascending: false })

    const all = (data || []) as Agent[]

    let filtered: Agent[]
    if (tab === 'pending') filtered = all.filter(a => !a.is_approved && !a.rejection_reason)
    else if (tab === 'active') filtered = all.filter(a => a.is_approved)
    else if (tab === 'rejected') filtered = all.filter(a => !a.is_approved && !!a.rejection_reason)
    else filtered = all

    setAgents(filtered)
    setLoading(false)
  }

  async function doAction(agentId: string, action: 'approve' | 'reject' | 'deactivate', reason?: string) {
    setProcessing(true)
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, action, reason })
      })
      const data = await res.json()
      if (!res.ok) { showToast(`❌ ${data.error || 'Failed'}`, false); return }
      showToast(
        action === 'approve' ? '✅ Agent approved!' :
        action === 'reject' ? '🚫 Agent rejected.' : '🚫 Agent deactivated.'
      )
      setSelected(null)
      load()
    } finally {
      setProcessing(false)
    }
  }

  async function approve(agent: Agent) {
    if (!confirm(`Approve ${agent.full_name || 'this agent'}? They will be able to start accepting deliveries.`)) return
    doAction(agent.id, 'approve')
  }

  async function reject(agent: Agent) {
    const reason = prompt('Enter rejection reason (will be shown to the agent):')
    if (!reason?.trim()) { showToast('Rejection reason is required.', false); return }
    doAction(agent.id, 'reject', reason.trim())
  }

  async function deactivate(agent: Agent) {
    const reason = prompt(`Reason for deactivating ${agent.full_name || 'this agent'}:`)
    if (!reason?.trim()) return
    doAction(agent.id, 'deactivate', reason.trim())
  }

  const tabCounts = { pending: 0, active: 0, rejected: 0, all: agents.length }

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

      <div className="flex-between" style={{ marginBottom: 20 }}>
        <h2>🛵 Delivery Agents</h2>
        <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>🔄 Refresh</button>
      </div>

      <div className="tabs" style={{ marginBottom: 20, maxWidth: 460 }}>
        {(['pending', 'active', 'rejected', 'all'] as const).map(t => (
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
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading agents...</td></tr>
            )}
            {!loading && agents.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No {tab === 'all' ? '' : tab} agents found</td></tr>
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
                <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{agent.license_number || '—'}</td>
                <td>{agent.total_deliveries || 0}</td>
                <td>₹{(agent.wallet_balance || 0).toFixed(0)}</td>
                <td>
                  {agent.is_approved
                    ? <span className="badge badge-green">✓ Active</span>
                    : agent.rejection_reason
                      ? <span className="badge badge-red">✕ Rejected</span>
                      : <span className="badge badge-yellow">⏳ Pending</span>
                  }
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setSelected(agent)}>👁 View</button>
                    {!agent.is_approved && !agent.rejection_reason && <>
                      <button className="btn btn-success btn-sm" onClick={() => approve(agent)}>✅ Approve</button>
                      <button className="btn btn-danger btn-sm" onClick={() => reject(agent)}>❌ Reject</button>
                    </>}
                    {agent.rejection_reason && !agent.is_approved && (
                      <button className="btn btn-success btn-sm" onClick={() => approve(agent)}>✅ Re-Approve</button>
                    )}
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
                { label: 'UPI ID', value: selected.upi_id || '—' },
                { label: 'Wallet Balance', value: `₹${(selected.wallet_balance || 0).toFixed(0)}` },
                { label: "Today's Earnings", value: `₹${(selected.today_earnings || 0).toFixed(0)}` },
                { label: 'Total Deliveries', value: String(selected.total_deliveries || 0) },
                { label: 'Availability', value: selected.is_available ? '🟢 Online' : '🔴 Offline' },
                { label: 'Registration Date', value: new Date(selected.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                { label: 'Terms Accepted', value: selected.terms_agreed ? '✅ Yes' : '❌ No' },
                { label: 'Status', value: selected.is_approved ? '✅ Approved' : selected.rejection_reason ? '❌ Rejected' : '⏳ Pending' },
              ].map(f => (
                <div key={f.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{f.label}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{f.value || '—'}</div>
                </div>
              ))}
            </div>

            {/* Document Viewer */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 10 }}>📄 Aadhaar Card</div>
              {selected.aadhar_url ? (
                <div style={{ border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg)' }}>
                  <a href={selected.aadhar_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                    <img src={selected.aadhar_url} alt="Aadhaar Card" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', textAlign: 'center', background: '#f0fdf4' }}>
                      🪪 View Full Image ↗
                    </div>
                  </a>
                </div>
              ) : (
                <div style={{ border: '1.5px solid #fca5a5', borderRadius: 8, padding: 20, textAlign: 'center', color: '#dc2626', fontSize: '0.85rem' }}>
                  ⚠️ Aadhaar Card Not Uploaded
                </div>
              )}
            </div>

            {selected.rejection_reason && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: '#dc2626' }}>
                ❌ Rejection Reason: <strong>{selected.rejection_reason}</strong>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {!selected.is_approved && !selected.rejection_reason && <>
                <button className="btn btn-success" disabled={processing} onClick={() => approve(selected)}>
                  {processing ? '⏳...' : '✅ Approve Agent'}
                </button>
                <button className="btn btn-danger" disabled={processing} onClick={() => reject(selected)}>
                  {processing ? '⏳...' : '❌ Reject'}
                </button>
              </>}
              {selected.rejection_reason && !selected.is_approved && (
                <button className="btn btn-success" disabled={processing} onClick={() => approve(selected)}>
                  {processing ? '⏳...' : '✅ Re-Approve'}
                </button>
              )}
              {selected.is_approved && (
                <button className="btn btn-danger" disabled={processing} onClick={() => deactivate(selected)}>
                  {processing ? '⏳...' : '🚫 Deactivate'}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
