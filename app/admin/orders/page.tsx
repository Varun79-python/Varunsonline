'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/modules/infrastructure/supabase/client'
import { SkeletonBlock } from '@/modules/shared-ui/components/ui/skeleton'

interface Order {
  id: string; order_number: string; status: string; total_amount: number; admin_earning: number;
  created_at: string; customer_id: string; shop_id: string; agent_id?: string; payment_method?: string;
  shops: { name: string; city: string } | null;
  customer: { full_name: string; phone: string } | null;
}

interface ShopDetail {
  shop: Record<string, any>
  owner: { full_name: string; phone: string; email: string; created_at: string } | null
  orders: Order[]
  orderCounts: { total: number; delivered: number; cancelled: number; pending: number }
  totalRevenue: number
}

export default function AdminOrders() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const pageSize = 25

  // Shop detail modal
  const [detailShopId, setDetailShopId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<ShopDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  // Agent detail modal
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null)
  const [detailAgent, setDetailAgent] = useState<Record<string, any> | null>(null)
  const [agentOrders, setAgentOrders] = useState<any[]>([])
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentError, setAgentError] = useState('')

  const STATUS_OPTIONS = ['all', 'placed', 'payment_confirmed', 'shop_accepted', 'order_packed', 'agent_assigned', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'rejected']
  const STATUS_COLOR: Record<string, string> = { placed: 'badge-blue', delivered: 'badge-green', cancelled: 'badge-red', rejected: 'badge-red', out_for_delivery: 'badge-blue', payment_confirmed: 'badge-orange' }

  // Get auth headers for API calls
  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}
  }

  async function load() {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const params = new URLSearchParams({ status: statusFilter, page: String(page), pageSize: String(pageSize) })
      const res = await fetch(`/api/admin/orders?${params}`, { headers })
      if (!res.ok) {
        console.error('Orders fetch failed:', await res.text())
        setOrders([])
      } else {
        const data = await res.json()
        setOrders(data.orders || [])
        setTotalPages(data.totalPages || 0)
      }
    } catch (err) {
      console.error('Orders load error:', err)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  // Open shop detail modal
  async function openShopDetail(shopId: string) {
    setDetailShopId(shopId)
    setDetailLoading(true)
    setDetailData(null)
    setDetailError('')
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/admin/shop-detail?id=${shopId}`, { headers })
      if (!res.ok) {
        const err = await res.json()
        setDetailError(err.error || 'Failed to load shop details')
      } else {
        const data = await res.json()
        setDetailData(data)
      }
    } catch {
      setDetailError('Network error loading shop details')
    } finally {
      setDetailLoading(false)
    }
  }

  // Open agent detail modal
  async function openAgentDetail(agentId: string) {
    setDetailAgentId(agentId)
    setAgentLoading(true)
    setDetailAgent(null)
    setAgentOrders([])
    setAgentError('')
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/admin/agent-detail?id=${agentId}`, { headers })
      if (!res.ok) {
        const err = await res.json()
        setAgentError(err.error || 'Failed to load agent details')
      } else {
        const data = await res.json()
        setDetailAgent(data.agent)
        setAgentOrders(data.orders || [])
      }
    } catch {
      setAgentError('Network error loading agent details')
    } finally {
      setAgentLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter, page])

  const filtered = search
    ? orders.filter(o => o.order_number?.toLowerCase().includes(search.toLowerCase()) || o.shops?.name?.toLowerCase().includes(search.toLowerCase()))
    : orders

  return (
    <div style={{ padding: '0 4px' }}>
      <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', marginBottom: 14, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Command Center
      </button>
      <h2 style={{ marginBottom: 16, fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>📦 Orders</h2>
      
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 150 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem' }}>🔍</span>
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', background: 'white' }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'All' : s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <div style={{ padding: 20 }}><SkeletonBlock lines={4} gap={12} /></div>}
        {!loading && filtered.length === 0 && <div style={{ textAlign: 'center', padding: 30, background: '#f8fafc', borderRadius: 12 }}>No orders found</div>}
        {filtered.map(o => (
          <a key={o.id} href={`/admin/orders/${o.id}`} style={{ display: 'block', background: 'white', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: 14, textDecoration: 'none' }}>
            {/* Row 1: Order number + Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 800, color: '#f97316', fontFamily: 'monospace' }}>{o.order_number}</span>
              <span style={{ background: STATUS_COLOR[o.status] === 'badge-green' ? '#dcfce7' : STATUS_COLOR[o.status] === 'badge-red' ? '#fee2e2' : '#fef3c7', color: STATUS_COLOR[o.status] === 'badge-green' ? '#16a34a' : STATUS_COLOR[o.status] === 'badge-red' ? '#dc2626' : '#d97706', fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{o.status.replace(/_/g, ' ')}</span>
            </div>
            {/* Row 2: Customer name */}
            <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, marginBottom: 3 }}>
              👤 {o.customer?.full_name || 'Unknown Customer'}
            </div>
            {/* Row 3: Shop + Agent */}
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {o.shop_id ? (
                <button
                  onClick={(e) => { e.preventDefault(); openShopDetail(o.shop_id) }}
                  style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', color: '#0ea5e9', fontWeight: 600, fontSize: '0.75rem', textDecoration: 'underline', textUnderlineOffset: 2 }}
                  title="View shop details"
                >
                  🏪 {o.shops?.name || 'View Shop'}
                </button>
              ) : (
                <span>🏪 {o.shops?.name || '—'}</span>
              )}
              {o.agent_id && (
                <button
                  onClick={(e) => { e.preventDefault(); openAgentDetail(o.agent_id!) }}
                  style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', color: '#0ea5e9', fontWeight: 500, fontSize: '0.75rem', textDecoration: 'underline', textUnderlineOffset: 2 }}
                  title="View delivery agent details"
                >
                  🛵 Delivery Agent
                </button>
              )}
              {o.shops?.city && <span>📍 {o.shops.city}</span>}
            </div>
            {/* Row 4: Amount + Admin earning + Payment + Date */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{o.total_amount}</span>
              <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>Admin: ₹{o.admin_earning || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.65rem', color: '#94a3b8' }}>
              <span>{o.payment_method === 'cod' ? '💵 COD' : '💳 Online'}</span>
              <span>{new Date(o.created_at).toLocaleDateString('en-IN')}</span>
            </div>
          </a>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20, padding: '12px 0' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ padding: '8px 16px', background: page <= 1 ? '#f1f5f9' : '#f97316', color: page <= 1 ? '#94a3b8' : 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ padding: '8px 16px', background: page >= totalPages ? '#f1f5f9' : '#f97316', color: page >= totalPages ? '#94a3b8' : 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Shop Detail Modal ─────────────────────────────────────────── */}
      {detailShopId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => { setDetailShopId(null); setDetailData(null); setDetailError('') }}
        >
          <div
            style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', fontWeight: 800 }}>
                🏪 {detailData ? detailData.shop.name as string : 'Shop Details'}
              </h3>
              <button
                onClick={() => { setDetailShopId(null); setDetailData(null); setDetailError('') }}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {detailLoading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
                  <div style={{ color: '#64748b' }}>Loading shop details...</div>
                </div>
              )}

              {detailError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 16, color: '#dc2626', fontWeight: 600, fontSize: '0.9rem' }}>
                  ❌ {detailError}
                </div>
              )}

              {detailData && !detailLoading && (
                <>
                  {/* Shop Stats Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{detailData.orderCounts.total}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Total Orders</div>
                    </div>
                    <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>{detailData.orderCounts.delivered}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Delivered</div>
                    </div>
                    <div style={{ background: '#fef2f2', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626' }}>{detailData.orderCounts.cancelled}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Cancelled</div>
                    </div>
                    <div style={{ background: '#fefce8', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ca8a04' }}>₹{detailData.totalRevenue.toFixed(0)}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Revenue</div>
                    </div>
                  </div>

                  {/* Shop Info Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
                    {(detailData.shop as Record<string, any>).shop_image_url && (
                      <div style={{ gridColumn: 'span 2', marginBottom: 4 }}>
                        <img
                          src={(detailData.shop as Record<string, any>).shop_image_url as string}
                          alt={(detailData.shop as Record<string, any>).name as string}
                          style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 12 }}
                        />
                      </div>
                    )}
                    <ShopInfo label="Shop Name" value={(detailData.shop as Record<string, any>).name as string} span={2} />
                    <ShopInfo label="Category" value={(detailData.shop as Record<string, any>).category as string} />
                    <ShopInfo label="City" value={(detailData.shop as Record<string, any>).city as string} />
                    <ShopInfo label="Address" value={(detailData.shop as Record<string, any>).address_line1 as string || '—'} span={2} />
                    {(detailData.shop as Record<string, any>).landmark && (
                      <ShopInfo label="Landmark" value={(detailData.shop as Record<string, any>).landmark as string} span={2} />
                    )}
                    {(detailData.shop as Record<string, any>).description && (
                      <ShopInfo label="Description" value={(detailData.shop as Record<string, any>).description as string} span={2} />
                    )}
                    <ShopInfo label="Owner" value={detailData.owner?.full_name || '—'} />
                    <ShopInfo label="Phone" value={detailData.owner?.phone || (detailData.shop as Record<string, any>).phone as string || '—'} />
                    <ShopInfo label="Email" value={detailData.owner?.email || (detailData.shop as Record<string, any>).email as string || '—'} />
                    <ShopInfo label="Status" value={(detailData.shop as Record<string, any>).is_open ? '🟢 Open' : '🔴 Closed'} />
                    <ShopInfo label="Rating" value={(detailData.shop as Record<string, any>).rating ? `⭐ ${Number((detailData.shop as Record<string, any>).rating).toFixed(1)}` : '—'} />
                    <ShopInfo label="UPI ID" value={(detailData.shop as Record<string, any>).upi_id as string || '—'} />
                    {(detailData.shop as Record<string, any>).latitude && (
                      <ShopInfo label="Location" value={`📍 ${Number((detailData.shop as Record<string, any>).latitude).toFixed(5)}, ${Number((detailData.shop as Record<string, any>).longitude).toFixed(5)}`} span={2} />
                    )}
                    <ShopInfo label="Registered" value={detailData.owner?.created_at ? new Date(detailData.owner.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
                    <ShopInfo label="Active" value={(detailData.shop as Record<string, any>).is_active ? '✅ Yes' : '❌ No'} />
                    {(detailData.shop as Record<string, any>).rejection_reason && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', gridColumn: 'span 2', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>
                        ⚠️ Rejection Reason: {(detailData.shop as Record<string, any>).rejection_reason as string}
                      </div>
                    )}
                  </div>

                  {/* Orders List */}
                  <div style={{ marginTop: 12 }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>📦 Recent Orders ({detailData.orders.length})</h4>
                    {detailData.orders.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 20, background: '#f8fafc', borderRadius: 8, color: '#94a3b8', fontSize: '0.85rem' }}>No orders yet from this shop.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                        {detailData.orders.map(ord => (
                          <div key={ord.id} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <a href={`/admin/orders/${ord.id}`} style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f97316', textDecoration: 'none', fontFamily: 'monospace' }}>
                                #{ord.order_number}
                              </a>
                              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>{new Date(ord.created_at).toLocaleDateString('en-IN')}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>₹{ord.total_amount}</div>
                              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 99, background: ord.status === 'delivered' ? '#dcfce7' : ord.status === 'cancelled' || ord.status === 'rejected' ? '#fee2e2' : '#fef3c7', color: ord.status === 'delivered' ? '#16a34a' : ord.status === 'cancelled' || ord.status === 'rejected' ? '#dc2626' : '#d97706', display: 'inline-block', fontWeight: 600 }}>
                                {ord.status.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Agent Detail Modal ───────────────────────────────────────── */}
      {detailAgentId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => { setDetailAgentId(null); setDetailAgent(null); setAgentOrders([]); setAgentError('') }}
        >
          <div
            style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', fontWeight: 800 }}>
                🛵 {detailAgent ? (detailAgent.full_name || 'Delivery Agent') : 'Agent Details'}
              </h3>
              <button
                onClick={() => { setDetailAgentId(null); setDetailAgent(null); setAgentOrders([]); setAgentError('') }}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {agentLoading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
                  <div style={{ color: '#64748b' }}>Loading agent details...</div>
                </div>
              )}

              {agentError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 16, color: '#dc2626', fontWeight: 600, fontSize: '0.9rem' }}>
                  ❌ {agentError}
                </div>
              )}

              {detailAgent && !agentLoading && (
                <>
                  {/* Stats Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{detailAgent.total_deliveries || 0}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Deliveries</div>
                    </div>
                    <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>₹{(detailAgent.wallet_balance || 0).toFixed(0)}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Wallet</div>
                    </div>
                    <div style={{ background: '#fefce8', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ca8a04' }}>₹{(agentOrders.filter((o: any) => o.status === 'delivered').reduce((s: number, o: any) => s + (o.agent_earning || 0), 0)).toFixed(0)}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Earnings</div>
                    </div>
                    <div style={{ background: detailAgent.is_available ? '#f0fdf4' : '#f1f5f9', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: detailAgent.is_available ? '#16a34a' : '#64748b' }}>{detailAgent.is_available ? '🟢' : '🔴'}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{detailAgent.is_available ? 'Online' : 'Offline'}</div>
                    </div>
                  </div>

                  {/* Agent Info Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
                    <ShopInfo label="Full Name" value={detailAgent.full_name || '—'} span={2} />
                    <ShopInfo label="Phone" value={detailAgent.phone || '—'} />
                    <ShopInfo label="Email" value={detailAgent.email || '—'} />
                    <ShopInfo label="Vehicle Type" value={detailAgent.vehicle_type || '—'} />
                    <ShopInfo label="Vehicle Number" value={detailAgent.vehicle_number || '—'} />
                    <ShopInfo label="UPI ID" value={detailAgent.upi_id || '—'} />
                    <ShopInfo label="License Number" value={detailAgent.license_number || '—'} />
                    <ShopInfo label="Status" value={detailAgent.is_approved ? '✅ Approved' : detailAgent.rejection_reason ? '❌ Rejected' : '⏳ Pending'} />
                    {detailAgent.rejection_reason && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', gridColumn: 'span 2', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>
                        ⚠️ Reason: {detailAgent.rejection_reason}
                      </div>
                    )}
                    <ShopInfo label="Registered" value={detailAgent.created_at ? new Date(detailAgent.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
                    <ShopInfo label="Today's Earnings" value={`₹${(detailAgent.today_earnings || 0).toFixed(0)}`} />
                  </div>

                  {/* Orders List */}
                  <div style={{ marginTop: 12 }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>📦 Orders Delivered ({agentOrders.length})</h4>
                    {agentOrders.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 20, background: '#f8fafc', borderRadius: 8, color: '#94a3b8', fontSize: '0.85rem' }}>No deliveries yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                        {agentOrders.map((ord: any) => (
                          <div key={ord.id} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <a href={`/admin/orders/${ord.id}`} style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f97316', textDecoration: 'none', fontFamily: 'monospace' }}>
                                #{ord.order_number}
                              </a>
                              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>{new Date(ord.created_at).toLocaleDateString('en-IN')}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>₹{ord.total_amount}</div>
                              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 99, background: ord.status === 'delivered' ? '#dcfce7' : ord.status === 'cancelled' || ord.status === 'rejected' ? '#fee2e2' : '#fef3c7', color: ord.status === 'delivered' ? '#16a34a' : ord.status === 'cancelled' || ord.status === 'rejected' ? '#dc2626' : '#d97706', display: 'inline-block', fontWeight: 600 }}>
                                {ord.status.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Small helper component for shop info rows
function ShopInfo({ label, value, span }: { label: string; value: string; span?: number }) {
  return (
    <div style={{
      background: '#f8fafc',
      padding: 12,
      borderRadius: 8,
      gridColumn: span === 2 ? 'span 2' : undefined,
    }}>
      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a', wordBreak: 'break-word' }}>{value || '—'}</div>
    </div>
  )
}
