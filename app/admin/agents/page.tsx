'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAdminAgents } from '@/app/admin/actions'
import { SkeletonCard } from '@/components/ui/skeleton'

interface Agent {
  id: string
  full_name: string; phone: string; email: string
  vehicle_type: string; vehicle_number: string; license_number: string
  license_url: string; aadhar_url: string; live_photo_url: string
  pan_url: string; vehicle_rc_url: string
  is_approved: boolean; is_active: boolean; is_available: boolean
  wallet_balance: number; total_deliveries: number; today_earnings: number
  rejection_reason: string | null; upi_id: string; created_at: string
}

export default function AdminAgents() {
  const supabase = createClient()
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const pageSize = 25
  
  // Refs to prevent duplicate fetches
  const loadingRef = useRef(false)
  const mountedRef = useRef(false)

  useEffect(() => { mountedRef.current = true }, [])

  // Read initial tab from URL (client-only, avoids hydration mismatch)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (['pending', 'active', 'rejected', 'all'].includes(tabParam || '')) {
      setTab(tabParam as 'pending' | 'active' | 'rejected' | 'all')
    }
  }, [])

  // Reset loading guard whenever tab/page changes (handles URL param tab too)
  useEffect(() => {
    loadingRef.current = false
  }, [tab, page])

  function showToast(msg: string, ok = true) {
    if (!mountedRef.current) return
    setToast({ msg, ok })
    setTimeout(() => { if (mountedRef.current) setToast(null) }, 3500)
  }

  async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    
    try {
      const { data, count, error } = await getAdminAgents(tab, page, pageSize)
      if (error) throw error

      if (!mountedRef.current) return
      
      setAgents((data || []) as Agent[])
      setTotalPages(Math.ceil((count || 0) / pageSize))
    } catch (err) {
      console.error('Failed to load agents:', err)
      showToast('Failed to load agents', false)
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        loadingRef.current = false
      }
    }
  }, [tab, page])

  useEffect(() => { 
    if (!loadingRef.current) load() 
  }, [load])

  async function doAction(agentId: string, action: 'approve' | 'reject' | 'deactivate', reason?: string) {
    setProcessing(true)
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ agentId, action, reason })
      })
      const data = await res.json()
      if (!res.ok) { showToast(`❌ ${data.error || 'Failed'}`, false); return }
      showToast(
        action === 'approve' ? '✅ Agent approved!' :
        action === 'reject' ? '🚫 Agent rejected.' : '🚫 Agent deactivated.'
      )
      load()
    } catch (err) {
      showToast('Action failed', false)
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

  async function reapproveAgent(agent: Agent) {
    if (!confirm(`Re-approve ${agent.full_name || 'this agent'}? They will be able to start accepting deliveries again.`)) return
    setProcessing(true)
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ agentId: agent.id, action: 'reapprove' })
      })
      const result = await res.json()
      if (!res.ok) { showToast(`❌ ${result.error || 'Failed'}`, false); return }
      showToast('✅ Agent re-approved!')
      load()
    } catch (err) {
      showToast('Action failed', false)
    } finally {
      setProcessing(false)
    }
  }

  async function deleteAgentPermanently(agent: Agent) {
    if (!confirm(`⚠️ PERMANENTLY DELETE ${agent.full_name || 'this agent'}? This will:\n\n• Delete all agent data\n• Delete uploaded documents\n• Allow them to register again\n\nThis cannot be undone!`)) return

    setProcessing(true)
    try {
      // Delete agent documents from storage
      const docUrls = [agent.aadhar_url, agent.license_url, agent.pan_url, agent.vehicle_rc_url].filter(Boolean)
      for (const url of docUrls) {
        try {
          const pathMatch = url?.match(/storage\.supabase\.co.*\/object\/(?:public\/)?[^/]+\/(.+)/i)
          if (pathMatch) {
            await supabase.storage.from('agent-documents').remove([pathMatch[1]])
          }
        } catch (e) { console.error('Delete file error:', e) }
      }

      // Delete agent from database
      const { error } = await supabase.from('delivery_agents').delete().eq('id', agent.id)
      if (error) throw error

      // ── INSTANT UI UPDATE ──────────────────────────────────────────────
      // Remove agent from local state immediately — no wait for re-fetch
      setAgents(prev => prev.filter(a => a.id !== agent.id))
      // Show success toast (non-blocking — unlike alert())
      showToast(`✅ "${agent.full_name}" permanently deleted.`)
      // Reset loadingRef guard so the follow-up load() actually runs
      loadingRef.current = false
      // Re-fetch to sync with server (catches any edge cases)
      load()
    } catch (err) {
      console.error('Delete error:', err)
      showToast('❌ Failed to delete agent. Please try again.', false)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="ag-container">
      {/* Toast */}
      {toast && (
        <div className="ag-toast" style={{ borderColor: toast.ok ? '#22c55e' : '#ef4444' }}>
          {toast.msg}
        </div>
      )}

      <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#22c55e', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', marginBottom: 14, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Command Center
      </button>
      <div style={{ marginBottom: 28 }}>
        <div className="ag-section-label">Fleet Management</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2, marginBottom: 4 }}>🛵 Delivery Agents</div>
            <div style={{ fontSize: '0.85rem', color: '#64748B' }}>Manage delivery fleet and agent registrations</div>
          </div>
          <button onClick={load} className="ag-refresh-btn">🔄 Refresh</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
        {(['pending', 'active', 'rejected', 'all'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1) }} style={{ 
            flex: '0 0 auto', padding: '10px 20px', borderRadius: 20, border: '1.5px solid', 
            background: tab === t ? '#22c55e' : 'white', borderColor: tab === t ? '#22c55e' : '#e2e8f0',
            color: tab === t ? 'white' : '#64748b', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Agents List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>}
        {!loading && agents.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, background: 'white', borderRadius: 16, border: '1.5px solid #e2e8f0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🛵</div>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', fontWeight: 500 }}>No agents found</p>
          </div>
        )}
        {agents.map(agent => (
          <div className="ag-card" key={agent.id}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
              <div style={{ width: 54, height: 54, borderRadius: 12, background: agent.is_available ? '#dcfce7' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0, border: '1px solid #f1f5f9' }}>
                {agent.is_available ? '🟢' : '🔴'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button
                      onClick={() => router.push(`/admin/agents/${agent.id}`)}
                      className="ag-name-btn"
                    >
                      {agent.full_name || 'Unknown'}
                    </button>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>{agent.phone || 'N/A'} • {agent.vehicle_type || 'N/A'}</div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {agent.is_approved ? (
                      <span className="ag-badge" style={{ background: '#dcfce7', color: '#16a34a' }}>Active</span>
                    ) : agent.rejection_reason ? (
                      <span className="ag-badge" style={{ background: '#fee2e2', color: '#dc2626' }}>Rejected</span>
                    ) : (
                      <span className="ag-badge" style={{ background: '#fef3c7', color: '#d97706' }}>Pending</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
              <div style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <span>🚗 {agent.vehicle_number || 'N/A'}</span>
                <span style={{ color: '#CBD5E1' }}>•</span>
                <span>📦 {agent.total_deliveries || 0}</span>
                <span style={{ color: '#CBD5E1' }}>•</span>
                <span>💰 ₹{(agent.wallet_balance || 0).toFixed(0)}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={() => router.push(`/admin/agents/${agent.id}`)} className="ag-btn ag-btn-view">View</button>
                {!agent.is_approved && !agent.rejection_reason && (
                  <>
                    <button onClick={() => approve(agent)} className="ag-btn ag-btn-approve">✓</button>
                    <button onClick={() => reject(agent)} className="ag-btn ag-btn-reject">✕</button>
                  </>
                )}
                {agent.is_approved && (
                  <button onClick={() => deactivate(agent)} className="ag-btn" style={{ background: '#ef4444', color: 'white' }}>⏸</button>
                )}
                {agent.is_approved && !agent.is_active && (
                  <button onClick={() => reapproveAgent(agent)} className="ag-btn ag-btn-approve">✅</button>
                )}
                {agent.rejection_reason && (
                  <button onClick={() => deleteAgentPermanently(agent)} className="ag-btn" style={{ background: '#dc2626', color: 'white' }}>🗑️</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="ag-pagination">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="ag-page-btn"
            style={{ background: page <= 1 ? '#f1f5f9' : '#22c55e', color: page <= 1 ? '#94a3b8' : 'white' }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="ag-page-btn"
            style={{ background: page >= totalPages ? '#f1f5f9' : '#22c55e', color: page >= totalPages ? '#94a3b8' : 'white' }}
          >
            Next →
          </button>
        </div>
      )}

      <style>{`
        .ag-container { max-width: 1000px; margin: 0 auto; }
        .ag-section-label { font-size: 0.75rem; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .ag-toast {
          position: fixed; top: 20; right: 20; z-index: 9999; background: white;
          border-radius: 10px;
          padding: 12px 20px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12); font-weight: 600; font-size: 0.92rem;
        }
        .ag-refresh-btn { background: #f1f5f9; border: none; border-radius: 10px; padding: 10px 18px; font-size: 0.78rem; font-weight: 600; color: #64748b; cursor: pointer; transition: opacity 0.15s; }
        .ag-refresh-btn:hover { opacity: 0.7; }
        .ag-card {
          background: white;
          border-radius: 16px;
          border: 1.5px solid #E2E8F0;
          padding: 16px 18px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .ag-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .ag-badge {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 8px;
          white-space: nowrap;
        }
        .ag-name-btn { background: none; border: none; padding: 0; margin: 0; cursor: pointer; font-weight: 800; font-size: 0.95rem; color: #0ea5e9; text-decoration: underline; text-underline-offset: 2px; text-align: left; display: block; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ag-name-btn:hover { opacity: 0.8; }
        .ag-btn {
          border: none;
          border-radius: 10px;
          padding: 8px 14px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s ease;
          white-space: nowrap;
        }
        .ag-btn:hover { opacity: 0.85; }
        .ag-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ag-btn-view { background: #f1f5f9; color: #475569; }
        .ag-btn-approve { background: #22c55e; color: white; }
        .ag-btn-reject { background: #dc2626; color: white; }
        .ag-pagination { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 24px; padding: 16px 0; }
        .ag-page-btn { border: none; border-radius: 10px; padding: 10px 20px; font-weight: 700; font-size: 0.82rem; cursor: pointer; transition: opacity 0.15s; }
        .ag-page-btn:hover:not(:disabled) { opacity: 0.85; }
        .ag-page-btn:disabled { cursor: not-allowed; }
        @media (max-width: 640px) {
          .ag-card { padding: 14px; }
        }
      `}</style>
    </div>
  )
}
