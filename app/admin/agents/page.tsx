'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAdminAgents } from '@/app/admin/actions'
import { SkeletonBlock, Skeleton, SkeletonCard } from '@/components/ui/skeleton'

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

// Document preview component (extracted to prevent recreation on every render)
interface DocPreviewProps {
  url?: string | null
  label: string
  fallback?: string
  getSignedUrl: (bucket: string, path: string) => Promise<string>
  onPreview: (url: string) => void
}

function DocPreview({ url, label, fallback = 'Document not uploaded', getSignedUrl, onPreview }: DocPreviewProps) {
  const [displayUrl, setDisplayUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!url) { setDisplayUrl(''); return }

    // Already has signed/token
    if (url.includes('signed=') || url.includes('?token=') || url.includes('X-Amz-')) {
      setDisplayUrl(url)
      return
    }

    // Extract bucket and path from Supabase storage URL
    const match = url.match(/storage\.supabase\.co.*\/object\/(?:public\/)?([^/]+)\/(.+)/i)
    if (!match) {
      setDisplayUrl(url)
      return
    }

    const bucket = match[1] || ''
    const path = match[2] || ''
    if (!bucket || !path) {
      setDisplayUrl(url)
      return
    }

    setLoading(true)
    getSignedUrl(bucket, path).then(signed => {
      if (mountedRef.current) {
        setDisplayUrl(signed || url)
        setLoading(false)
      }
    }).catch(() => {
      if (mountedRef.current) {
        setDisplayUrl(url)
        setLoading(false)
      }
    })
  }, [url, getSignedUrl])

  if (!url) {
    return (
      <div style={{ border: '1.5px solid #fca5a5', borderRadius: 8, padding: 16, textAlign: 'center', color: '#dc2626', fontSize: '0.8rem' }}>
        ⚠️ {fallback}
      </div>
    )
  }

  return (
    <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
      {loading ? (
        <div style={{ width: '100%', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <Skeleton width={160} height={120} borderRadius={8} />
        </div>
      ) : (
        <img
          src={displayUrl}
          alt={label}
          style={{ width: '100%', height: 160, objectFit: 'cover', cursor: 'pointer' }}
          onClick={() => displayUrl && onPreview(displayUrl)}
          onError={() => {
            setDisplayUrl(url)
          }}
        />
      )}
      <div style={{ padding: '8px 12px', background: '#f8fafc', textAlign: 'center' }}>
        <button
          onClick={() => displayUrl && window.open(displayUrl, '_blank')}
          style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, cursor: displayUrl ? 'pointer' : 'not-allowed', opacity: displayUrl ? 1 : 0.5 }}
          disabled={!displayUrl}
        >
          ↗ View Full
        </button>
      </div>
    </div>
  )
}

export default function AdminAgents() {
  const supabase = createClient()
  const [agents, setAgents] = useState<Agent[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Agent | null>(null)
  const [agentOrders, setAgentOrders] = useState<{id:string;order_number:string;status:string;agent_earning:number;created_at:string}[]>([])
  const [agentOrdersLoading, setAgentOrdersLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const pageSize = 25
  
  // Refs to prevent duplicate fetches
  const loadingRef = useRef(false)
  const mountedRef = useRef(false)

  useEffect(() => { mountedRef.current = true }, [])

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
      setSelected(null)
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
      const data = await res.json()
      if (!res.ok) { showToast(`❌ ${data.error || 'Failed'}`, false); return }
      showToast('✅ Agent re-approved!')
      setSelected(null)
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
      // Close modal first so user sees the list immediately
      setSelected(null)
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

  // Signed URL cache (ref-based for immediate access)
  const signedCache = useRef<Record<string, string>>({})

  async function getSignedUrl(bucket: string, path: string): Promise<string> {
    const cacheKey = `${bucket}:${path}`
    if (signedCache.current[cacheKey]) return signedCache.current[cacheKey]
    try {
      const res = await fetch(`/api/storage/sign?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`)
      const data = await res.json()
      if (data.url) {
        signedCache.current[cacheKey] = data.url
        return data.url
      }
    } catch (err) { console.error('Sign URL error:', err) }
    return ''
  }

  return (
    <div style={{ padding: '0 4px' }}>
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

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}
          onClick={() => setPreviewImage(null)}
        >
          <button 
            style={{ position: 'absolute', top: 20, right: 20, background: 'white', border: 'none', borderRadius: 20, width: 40, height: 40, fontSize: '1.2rem', cursor: 'pointer' }}
            onClick={() => setPreviewImage(null)}
          >
            ✕
          </button>
          <img 
            src={previewImage} 
            alt="Preview" 
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>🛵 Delivery Agents</h2>
        <button onClick={load} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>🔄 Refresh</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {(['pending', 'active', 'rejected', 'all'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1) }} style={{ 
            flex: '0 0 auto', padding: '10px 18px', borderRadius: 20, border: '1.5px solid', 
            background: tab === t ? '#22c55e' : 'white', borderColor: tab === t ? '#22c55e' : '#e2e8f0',
            color: tab === t ? 'white' : '#64748b', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Agents List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>}
        {!loading && agents.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, background: '#f8fafc', borderRadius: 12 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🛵</div>
            <p style={{ color: '#64748b' }}>No agents found</p>
          </div>
        )}
        {agents.map(agent => (
          <div key={agent.id} style={{ background: 'white', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: 14 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 50, height: 50, borderRadius: 10, background: agent.is_available ? '#dcfce7' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                {agent.is_available ? '🟢' : '🔴'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{agent.full_name || 'Unknown'}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{agent.phone || 'N/A'} • {agent.vehicle_type || 'N/A'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {agent.is_approved ? (
                  <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>Active</span>
                ) : agent.rejection_reason ? (
                  <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>Rejected</span>
                ) : (
                  <span style={{ background: '#fef3c7', color: '#d97706', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>Pending</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                🚗 {agent.vehicle_number || 'N/A'} • 📦 {agent.total_deliveries || 0} deliveries • 💰 ₹{(agent.wallet_balance || 0).toFixed(0)}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => {
                  setSelected(agent)
                  setAgentOrders([])
                  setAgentOrdersLoading(true)
                  supabase.from('orders').select('id,order_number,status,agent_earning,created_at')
                    .eq('agent_id', agent.id).order('created_at', { ascending: false }).limit(20)
                    .then(({ data }: { data: {id:string;order_number:string;status:string;agent_earning:number;created_at:string}[] | null }) => { setAgentOrders(data || []); setAgentOrdersLoading(false) })
                }} style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>View</button>
                {!agent.is_approved && !agent.rejection_reason && (
                  <>
                    <button onClick={() => approve(agent)} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>✓</button>
                    <button onClick={() => reject(agent)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>✕</button>
                  </>
                )}
                {agent.is_approved && (
                  <button onClick={() => deactivate(agent)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>⏸</button>
                )}
                {/* Reapprove button for deactivated agents */}
                {agent.is_approved && !agent.is_active && (
                  <button onClick={() => reapproveAgent(agent)} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                    ✅
                  </button>
                )}
                {/* Delete permanently button for rejected agents */}
                {agent.rejection_reason && (
                  <button onClick={() => deleteAgentPermanently(agent)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                    🗑️
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20, padding: '12px 0' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ padding: '8px 16px', background: page <= 1 ? '#f1f5f9' : '#22c55e', color: page <= 1 ? '#94a3b8' : 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ padding: '8px 16px', background: page >= totalPages ? '#f1f5f9' : '#22c55e', color: page >= totalPages ? '#94a3b8' : 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Next →
          </button>
        </div>
      )}

      {/* Detail Modal - Responsive */}
      {selected && (
        <div 
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => setSelected(null)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh',
              overflow: 'auto', position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>🛵 Agent Details</h3>
              <button 
                onClick={() => setSelected(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: '1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 20 }}>
              {/* Basic Info Grid */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase' }}>Basic Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  {[
                    { label: 'Full Name', value: selected.full_name },
                    { label: 'Phone', value: selected.phone },
                    { label: 'Email', value: selected.email },
                    { label: 'Vehicle Type', value: selected.vehicle_type },
                    { label: 'Vehicle Number', value: selected.vehicle_number },
                    { label: 'UPI ID', value: selected.upi_id || '—' },
                  ].map(f => (
                    <div key={f.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>{f.label}</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{f.value || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Stats */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase' }}>Performance</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Wallet', value: `₹${(selected.wallet_balance || 0).toFixed(0)}` },
                    { label: "Today's", value: `₹${(selected.today_earnings || 0).toFixed(0)}` },
                    { label: 'Deliveries', value: String(selected.total_deliveries || 0) },
                  ].map(f => (
                    <div key={f.label} style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>{f.label}</div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#16a34a' }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documents */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase' }}>📄 Documents</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>Aadhaar Card</div>
<DocPreview url={selected.aadhar_url} label="Aadhaar" fallback="Not uploaded" getSignedUrl={getSignedUrl} onPreview={setPreviewImage} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>License</div>
                      <DocPreview url={selected.license_url} label="License" fallback="Not uploaded" getSignedUrl={getSignedUrl} onPreview={setPreviewImage} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>PAN Card</div>
                      <DocPreview url={selected.pan_url} label="PAN" fallback="Not uploaded" getSignedUrl={getSignedUrl} onPreview={setPreviewImage} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>Vehicle RC</div>
                      <DocPreview url={selected.vehicle_rc_url} label="RC" fallback="Not uploaded" getSignedUrl={getSignedUrl} onPreview={setPreviewImage} />
                  </div>
                </div>
              </div>

              {/* Agent Orders */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase' }}>📦 Orders Delivered</h4>
                {agentOrdersLoading ? <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Loading orders...</div> :
                agentOrders.length === 0 ? <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No deliveries yet.</div> :
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {agentOrders.map(ord => (
                    <div key={ord.id} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>#{ord.order_number}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{new Date(ord.created_at).toLocaleDateString('en-IN')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#16a34a' }}>₹{ord.agent_earning?.toFixed(0)}</div>
                        <div style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: 99, background: ord.status === 'delivered' ? '#dcfce7' : '#fef3c7', color: ord.status === 'delivered' ? '#16a34a' : '#d97706', display: 'inline-block' }}>{ord.status}</div>
                      </div>
                    </div>
                  ))}
                </div>}
              </div>

              {/* Status */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <span style={{ background: selected.is_available ? '#dcfce7' : '#f1f5f9', color: selected.is_available ? '#16a34a' : '#64748b', padding: '6px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                  {selected.is_available ? '🟢 Online' : '🔴 Offline'}
                </span>
                <span style={{ background: selected.is_approved ? '#dcfce7' : selected.rejection_reason ? '#fee2e2' : '#fef3c7', color: selected.is_approved ? '#16a34a' : selected.rejection_reason ? '#dc2626' : '#d97706', padding: '6px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                  {selected.is_approved ? '✅ Approved' : selected.rejection_reason ? '❌ Rejected' : '⏳ Pending'}
                </span>
                <span style={{ background: '#f8fafc', color: '#64748b', padding: '6px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                  📅 {new Date(selected.created_at).toLocaleDateString('en-IN')}
                </span>
              </div>

              {selected.rejection_reason && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: '0.85rem', color: '#dc2626' }}>
                  ❌ Rejection Reason: <strong>{selected.rejection_reason}</strong>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {!selected.is_approved && !selected.rejection_reason && (
                  <>
                    <button disabled={processing} onClick={() => approve(selected)} style={{ padding: '10px 20px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer' }}>
                      {processing ? '⏳' : '✅ Approve'}
                    </button>
                    <button disabled={processing} onClick={() => reject(selected)} style={{ padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer' }}>
                      {processing ? '⏳' : '❌ Reject'}
                    </button>
                  </>
                )}
                {selected.is_approved && !selected.is_active && (
                  <button disabled={processing} onClick={() => reapproveAgent(selected)} style={{ padding: '10px 20px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer' }}>
                    {processing ? '⏳' : '✅ Reapprove'}
                  </button>
                )}
                {selected.is_approved && (
                  <button disabled={processing} onClick={() => deactivate(selected)} style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer' }}>
                    {processing ? '⏳' : '🚫 Deactivate'}
                  </button>
                )}
                {selected.rejection_reason && (
                  <button disabled={processing} onClick={() => deleteAgentPermanently(selected)} style={{ padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer' }}>
                    {processing ? '⏳' : '🗑️ Delete Permanently'}
                  </button>
                )}
                <button onClick={() => setSelected(null)} style={{ padding: '10px 20px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
