'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'

// ── Types ──
interface AgentDetail {
  agent: Record<string, any>
  profile: Record<string, any> | null
  orders: Array<{
    id: string; order_number: string; status: string; total_amount: number
    subtotal: number; delivery_charge: number; platform_fee: number
    admin_earning: number; shopkeeper_earning: number; agent_earning: number
    payment_method: string; created_at: string
  }>
  orderCounts: { total: number; delivered: number; cancelled: number; pending: number }
  totalEarnings: number
}

function InfoRow({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', gap: 12 }}>
      <span style={{ color: '#64748b', fontSize: '0.85rem', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', textAlign: 'right', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-word', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

function Card({ title, icon, children, accent }: { title: string; icon: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '18px 20px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${accent || '#e2e8f0'}` }}>
      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  )
}

// ── Document preview component ──
function DocPreview({ url, label, fallback = 'Document not uploaded', getSignedUrl, onPreview }: {
  url?: string | null; label: string; fallback?: string
  getSignedUrl: (bucket: string, path: string) => Promise<string>
  onPreview: (url: string) => void
}) {
  const [displayUrl, setDisplayUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!url) { setDisplayUrl(''); return }
    if (url.includes('signed=') || url.includes('?token=') || url.includes('X-Amz-')) {
      setDisplayUrl(url); return
    }
    const match = url.match(/storage\.supabase\.co.*\/object\/(?:public\/)?([^/]+)\/(.+)/i)
    if (!match) { setDisplayUrl(url); return }
    const bucket = match[1] || ''
    const path = match[2] || ''
    if (!bucket || !path) { setDisplayUrl(url); return }
    setLoading(true)
    getSignedUrl(bucket, path).then(signed => {
      if (mountedRef.current) { setDisplayUrl(signed || url); setLoading(false) }
    }).catch(() => { if (mountedRef.current) { setDisplayUrl(url); setLoading(false) } })
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
        <img src={displayUrl} alt={label} style={{ width: '100%', height: 160, objectFit: 'cover', cursor: 'pointer' }}
          onClick={() => displayUrl && onPreview(displayUrl)}
          onError={() => setDisplayUrl(url || '')} />
      )}
      <div style={{ padding: '8px 12px', background: '#f8fafc', textAlign: 'center' }}>
        <button onClick={() => displayUrl && window.open(displayUrl, '_blank')}
          style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, cursor: displayUrl ? 'pointer' : 'not-allowed', opacity: displayUrl ? 1 : 0.5 }}
          disabled={!displayUrl}>
          ↗ View Full
        </button>
      </div>
    </div>
  )
}

export default function AdminAgentDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const signedCache = useRef<Record<string, string>>({})

  const getSignedUrl = useCallback(async (bucket: string, path: string): Promise<string> => {
    const cacheKey = `${bucket}:${path}`
    if (signedCache.current[cacheKey]) return signedCache.current[cacheKey]
    try {
      const res = await fetch(`/api/storage/sign?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`)
      const d = await res.json()
      if (d.url) { signedCache.current[cacheKey] = d.url; return d.url }
    } catch { /* ignore */ }
    return ''
  }, [])

  async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  async function loadData() {
    setLoading(true); setError('')
    try {
      const h = await getAuthHeader()
      const res = await fetch(`/api/admin/agent-detail/${id}`, { headers: h })
      const json = await res.json()
      if (json.error) setError(json.error); else setData(json)
    } catch { setError('Failed to load agent details') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [id])

  async function doAction(action: 'approve' | 'reject' | 'deactivate', reason?: string) {
    setProcessing(true)
    try {
      const h = await getAuthHeader()
      const res = await fetch('/api/admin/agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ agentId: id, action, reason })
      })
      const r = await res.json()
      if (!res.ok) { alert(`❌ ${r.error || 'Failed'}`); return }
      alert(action === 'approve' ? '✅ Agent approved!' : action === 'reject' ? '🚫 Agent rejected.' : '🚫 Agent deactivated.')
      await loadData()
    } catch { alert('Action failed') }
    finally { setProcessing(false) }
  }

  function handleApprove() {
    if (!confirm('Approve this agent? They will be able to start accepting deliveries.')) return
    doAction('approve')
  }
  function handleReject() {
    const reason = prompt('Enter rejection reason (will be shown to the agent):')
    if (!reason?.trim()) { alert('Rejection reason is required.'); return }
    doAction('reject', reason.trim())
  }
  function handleDeactivate() {
    const reason = prompt('Reason for deactivating this agent:')
    if (!reason?.trim()) return
    doAction('deactivate', reason.trim())
  }
  async function handleReapprove() {
    if (!confirm('Re-approve this agent? They will be able to start accepting deliveries again.')) return
    setProcessing(true)
    try {
      const h = await getAuthHeader()
      const res = await fetch('/api/admin/agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ agentId: id, action: 'reapprove' })
      })
      const r = await res.json()
      if (!res.ok) { alert(`❌ ${r.error || 'Failed'}`); return }
      alert('✅ Agent re-approved!')
      await loadData()
    } catch { alert('Action failed') }
    finally { setProcessing(false) }
  }
  async function handleDeletePermanently() {
    if (!data) return
    if (!confirm(`⚠️ PERMANENTLY DELETE ${data.agent.full_name || 'this agent'}?\n\n• Delete all agent data\n• Delete uploaded documents\n• Allow them to register again\n\nThis cannot be undone!`)) return
    setProcessing(true)
    try {
      const agent = data.agent
      const docUrls = [agent.aadhar_url, agent.license_url, agent.pan_url, agent.vehicle_rc_url].filter(Boolean)
      for (const url of docUrls) {
        try {
          const m = url?.match(/storage\.supabase\.co.*\/object\/(?:public\/)?[^/]+\/(.+)/i)
          if (m) await supabase.storage.from('agent-documents').remove([m[1]])
        } catch { /* ignore */ }
      }
      const { error: delErr } = await supabase.from('delivery_agents').delete().eq('id', id)
      if (delErr) throw delErr
      alert(`✅ "${agent.full_name}" permanently deleted.`)
      router.push('/admin/agents')
    } catch { alert('❌ Failed to delete agent. Please try again.') }
    finally { setProcessing(false) }
  }

  function fmt(dt: string | null | undefined) {
    if (!dt) return null
    return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
  }
  function fmtDate(dt: string | null | undefined) {
    if (!dt) return null
    return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#22c55e', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (error || !data) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: '#ef4444', fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>❌ Error</div>
      <div style={{ color: '#64748b', marginBottom: 16 }}>{error || 'Agent not found'}</div>
      <button onClick={() => router.back()} style={{ padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>← Go Back</button>
    </div>
  )

  const { agent, profile, orders, orderCounts, totalEarnings } = data

  return (
    <div className="ad-container">
      {/* Image Preview Modal */}
      {previewImage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setPreviewImage(null)}>
          <button style={{ position: 'absolute', top: 20, right: 20, background: 'white', border: 'none', borderRadius: 20, width: 40, height: 40, fontSize: '1.2rem', cursor: 'pointer' }}
            onClick={() => setPreviewImage(null)}>✕</button>
          <img src={previewImage} alt="Preview" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}

      {/* Back */}
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#22c55e', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', marginBottom: 18, padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Back to Agents
      </button>

      {/* ── Header ── */}
      <div className="ad-header">
        <div>
          <div className="ad-header-name">{agent.full_name || 'Unnamed Agent'}</div>
          <div className="ad-header-meta">
            {agent.vehicle_type || 'No vehicle'} • {agent.phone || 'N/A'} • Joined {fmtDate(agent.created_at)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`ad-status ${agent.is_available ? 'ad-status-available' : 'ad-status-offline'}`}>
            {agent.is_available ? '🟢 Online' : '🔴 Offline'}
          </span>
          <span className={`ad-status ${agent.is_approved ? 'ad-status-approved' : agent.rejection_reason ? 'ad-status-rejected' : 'ad-status-pending'}`}>
            {agent.is_approved ? '✅ Approved' : agent.rejection_reason ? '❌ Rejected' : '⏳ Pending'}
          </span>
        </div>
      </div>

      {/* ── Basic Info ── */}
      <Card title="Basic Information" icon="👤">
        <InfoRow label="Full Name" value={agent.full_name || profile?.full_name} />
        <InfoRow label="Phone" value={agent.phone || profile?.phone} />
        <InfoRow label="Email" value={agent.email || profile?.email} />
        <InfoRow label="Vehicle Type" value={agent.vehicle_type} />
        <InfoRow label="Vehicle Number" value={agent.vehicle_number} />
        <InfoRow label="License Number" value={agent.license_number} />
        <InfoRow label="UPI ID" value={agent.upi_id || '—'} />
        <InfoRow label="Agent ID" value={agent.id} mono />
      </Card>

      {/* ── Performance ── */}
      <Card title="Performance" icon="📊" accent="#dcfce7">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            { label: 'Wallet Balance', value: `₹${(agent.wallet_balance || 0).toFixed(0)}` },
            { label: "Today's Earnings", value: `₹${(agent.today_earnings || 0).toFixed(0)}` },
            { label: 'Total Deliveries', value: String(agent.total_deliveries || 0) },
          ].map(f => (
            <div key={f.label} style={{ background: '#f0fdf4', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#16a34a' }}>{f.value}</div>
            </div>
          ))}
        </div>
        <InfoRow label="Total Earnings (delivered)" value={`₹${totalEarnings.toFixed(0)}`} />
      </Card>

      {/* ── Documents ── */}
      <Card title="Documents" icon="📄">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>Aadhaar Card</div>
            <DocPreview url={agent.aadhar_url} label="Aadhaar" fallback="Not uploaded" getSignedUrl={getSignedUrl} onPreview={setPreviewImage} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>License</div>
            <DocPreview url={agent.license_url} label="License" fallback="Not uploaded" getSignedUrl={getSignedUrl} onPreview={setPreviewImage} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>PAN Card</div>
            <DocPreview url={agent.pan_url} label="PAN" fallback="Not uploaded" getSignedUrl={getSignedUrl} onPreview={setPreviewImage} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>Vehicle RC</div>
            <DocPreview url={agent.vehicle_rc_url} label="RC" fallback="Not uploaded" getSignedUrl={getSignedUrl} onPreview={setPreviewImage} />
          </div>
        </div>
      </Card>

      {/* ── Orders ── */}
      <Card title={`Orders (${orderCounts.total})`} icon="📦">
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 12px', background: '#f1f5f9', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>Total: {orderCounts.total}</span>
          <span style={{ padding: '4px 12px', background: '#dcfce7', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, color: '#16a34a' }}>✅ Delivered: {orderCounts.delivered}</span>
          <span style={{ padding: '4px 12px', background: '#fef3c7', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, color: '#d97706' }}>⏳ Pending: {orderCounts.pending}</span>
          <span style={{ padding: '4px 12px', background: '#fee2e2', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, color: '#dc2626' }}>❌ Cancelled: {orderCounts.cancelled}</span>
        </div>
        {orders.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '12px 0' }}>No deliveries yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
            {orders.map(o => (
              <div key={o.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>#<span>{o.order_number}</span></div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{fmt(o.created_at)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>₹{o.total_amount}</div>
                    <span style={{
                      fontSize: '0.68rem', padding: '2px 8px', borderRadius: 99,
                      background: o.status === 'delivered' ? '#dcfce7' : o.status === 'cancelled' || o.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                      color: o.status === 'delivered' ? '#16a34a' : o.status === 'cancelled' || o.status === 'rejected' ? '#dc2626' : '#d97706',
                      display: 'inline-block', marginTop: 2
                    }}>{o.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: '0.72rem', color: '#64748b', flexWrap: 'wrap' }}>
                  <span>💵 Agent: <strong>₹{o.agent_earning?.toFixed(0)}</strong></span>
                  <span>💰 Admin: <strong>₹{o.admin_earning?.toFixed(0)}</strong></span>
                  <span>🏪 Shop: <strong>₹{o.shopkeeper_earning?.toFixed(0)}</strong></span>
                  {o.payment_method && <span>💳 {o.payment_method}</span>}
                  {o.delivery_charge > 0 && <span>🚚 ₹{o.delivery_charge}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Rejection Reason ── */}
      {agent.rejection_reason && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '14px 18px', marginBottom: 16, fontSize: '0.85rem', color: '#dc2626' }}>
          ❌ Rejection Reason: <strong>{agent.rejection_reason}</strong>
        </div>
      )}

      {/* ── Actions ── */}
      <Card title="Admin Actions" icon="⚙️" accent="#e2e8f0">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!agent.is_approved && !agent.rejection_reason && (
            <>
              <button onClick={handleApprove} disabled={processing} className="ad-action-btn" style={{ background: '#22c55e', color: 'white' }}>
                {processing ? '⏳' : '✅ Approve Agent'}
              </button>
              <button onClick={handleReject} disabled={processing} className="ad-action-btn" style={{ background: '#dc2626', color: 'white' }}>
                {processing ? '⏳' : '❌ Reject Agent'}
              </button>
            </>
          )}
          {agent.is_approved && !agent.is_active && (
            <button onClick={handleReapprove} disabled={processing} className="ad-action-btn" style={{ background: '#22c55e', color: 'white' }}>
              {processing ? '⏳' : '✅ Reapprove & Activate'}
            </button>
          )}
          {agent.is_approved && (
            <button onClick={handleDeactivate} disabled={processing} className="ad-action-btn" style={{ background: '#ef4444', color: 'white' }}>
              {processing ? '⏳' : '🚫 Deactivate Agent'}
            </button>
          )}
          {agent.rejection_reason && (
            <button onClick={handleDeletePermanently} disabled={processing} className="ad-action-btn" style={{ background: '#dc2626', color: 'white' }}>
              {processing ? '⏳' : '🗑️ Delete Permanently'}
            </button>
          )}
        </div>
      </Card>

      <style>{`
        .ad-container { max-width: 720px; margin: 0 auto; padding: 4px 0; }
        .ad-header {
          background: linear-gradient(135deg, #f0fdf4, #dcfce7);
          border-radius: 16px;
          padding: 20px 24px;
          margin-bottom: 16px;
          border: 1.5px solid #bbf7d0;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 12px;
        }
        .ad-header-name { font-weight: 900; font-size: 1.4rem; color: #16a34a; }
        .ad-header-meta { font-size: 0.82rem; color: #6b7280; margin-top: 4px; }
        .ad-status {
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 0.82rem;
          white-space: nowrap;
        }
        .ad-status-available { background: #dcfce7; color: #16a34a; border: 1.5px solid #bbf7d0; }
        .ad-status-offline { background: #f1f5f9; color: #64748b; border: 1.5px solid #e2e8f0; }
        .ad-status-approved { background: #dcfce7; color: #16a34a; border: 1.5px solid #bbf7d0; }
        .ad-status-pending { background: #fef3c7; color: #d97706; border: 1.5px solid #fed7aa; }
        .ad-status-rejected { background: #fee2e2; color: #dc2626; border: 1.5px solid #fecaca; }
        .ad-action-btn {
          border: none;
          border-radius: 12px;
          padding: 14px 20px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }
        .ad-action-btn:hover { opacity: 0.85; }
        .ad-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        @media (max-width: 640px) {
          .ad-header { padding: 16px; }
          .ad-header-name { font-size: 1.2rem; }
        }
      `}</style>
    </div>
  )
}
