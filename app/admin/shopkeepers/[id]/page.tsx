'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Types ──
interface ShopkeeperProfile {
  id: string; full_name: string | null; email: string | null; phone: string | null
  gender: string | null; is_active: boolean; created_at: string
}

interface Shop {
  id: string; name: string; category: string | null; city: string | null
  is_approved: boolean; is_active: boolean; is_open: boolean
  shop_image_url: string | null; rating: number | null; total_orders: number | null
  rejection_reason: string | null; created_at: string
}

interface Document {
  id: string; status: string; shop_name: string | null; shop_photo_url: string | null
  aadhar_url: string | null; rejection_reason: string | null; created_at: string
}

interface Order {
  id: string; order_number: string; status: string; total_amount: number
  admin_earning: number; shopkeeper_earning: number; agent_earning: number
  payment_method: string; shop_name: string; created_at: string
}

interface Subscription {
  id: string; shop_id: string; plan_id: string; status: string
  start_date: string; end_date: string; amount_paid: number | null
  auto_renew: boolean; created_at: string
  subscription_plans?: { name: string; price: number; duration_days: number; features: any }
}

interface SubPayment {
  id: string; amount_paid: number; payment_method: string; status: string; created_at: string
}

interface ShopkeeperDetail {
  profile: ShopkeeperProfile
  shops: Shop[]
  documents: Document[]
  orders: Order[]
  orderCounts: { total: number; delivered: number; cancelled: number; pending: number }
  totalRevenue: number
  totalShopEarnings: number
  subscriptions: Subscription[]
  subPayments: SubPayment[]
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

const STATUS_COLOR: Record<string, string> = {
  delivered: '#22c55e', cancelled: '#ef4444', rejected: '#ef4444',
  payment_confirmed: '#22c55e', agent_assigned: '#8b5cf6',
  out_for_delivery: '#0ea5e9', picked_up: '#8b5cf6',
  shop_accepted: '#f97316', order_packed: '#f97316', placed: '#f97316'
}

export default function AdminShopkeeperDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<ShopkeeperDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      const res = await fetch(`/api/admin/shopkeeper-detail/${id}`, { headers })
      const json = await res.json()
      if (json.error) setError(json.error); else setData(json)
    } catch { setError('Failed to load shopkeeper details') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [id])

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
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (error || !data) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: '#ef4444', fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>❌ Error</div>
      <div style={{ color: '#64748b', marginBottom: 16 }}>{error || 'Shopkeeper not found'}</div>
      <button onClick={() => router.push('/admin')} style={{ padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>← Go Back</button>
    </div>
  )

  const { profile, shops, documents, orders, orderCounts, totalRevenue, totalShopEarnings, subscriptions, subPayments } = data
  const allShopsBlocked = shops.length > 0 && shops.every(s => s.rejection_reason === 'BLOCKED')

  return (
    <div className="sk-container">
      {/* Back */}
      <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', marginBottom: 18, padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Command Center
      </button>

      {/* ── Header ── */}
      <div className="sk-header">
        <div>
          <div className="sk-header-name">{profile.full_name || 'Unnamed Shopkeeper'}</div>
          <div className="sk-header-meta">
            {profile.email || 'No email'} • {profile.phone || 'No phone'} • {shops.length} shop{shops.length !== 1 ? 's' : ''} • Joined {fmtDate(profile.created_at)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`sk-status ${profile.is_active && !allShopsBlocked ? 'sk-status-active' : 'sk-status-inactive'}`}>
            {profile.is_active && !allShopsBlocked ? '🟢 Active' : '🔴 Inactive'}
          </span>
        </div>
      </div>

      {/* ── Profile Info ── */}
      <Card title="Profile Information" icon="👤">
        <InfoRow label="Full Name" value={profile.full_name} />
        <InfoRow label="Email" value={profile.email} />
        <InfoRow label="Phone" value={profile.phone} />
        <InfoRow label="Gender" value={profile.gender} />
        <InfoRow label="Shopkeeper ID" value={profile.id} mono />
        <InfoRow label="Joined" value={fmtDate(profile.created_at)} />
      </Card>

      {/* ── Shops ── */}
      <Card title={`Shops (${shops.length})`} icon="🏪">
        {shops.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '12px 0' }}>No shops created yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {shops.map(shop => (
              <div key={shop.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', cursor: 'pointer' }}
                onClick={() => router.push(`/admin/shops/${shop.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f97316' }}>
                    {shop.name}
                    {shop.shop_image_url && <span style={{ marginLeft: 8, fontSize: '0.7rem' }}>🖼️</span>}
                  </div>
                  {shop.is_approved ? (
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 600, background: shop.is_active ? '#dcfce7' : '#fef3c7', color: shop.is_active ? '#16a34a' : '#d97706' }}>
                      {shop.is_active ? (shop.is_open ? '🟢 Open' : '🔴 Closed') : '⏸️ Inactive'}
                    </span>
                  ) : shop.rejection_reason === 'BLOCKED' ? (
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 600, background: '#fee2e2', color: '#dc2626' }}>🚫 Blocked</span>
                  ) : shop.rejection_reason ? (
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 600, background: '#fee2e2', color: '#dc2626' }}>❌ Rejected</span>
                  ) : (
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 600, background: '#fef3c7', color: '#d97706' }}>⏳ Pending</span>
                  )}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                  {shop.category || 'N/A'} • {shop.city || 'N/A'}
                  {shop.rating ? ` • ⭐ ${Number(shop.rating).toFixed(1)}` : ''}
                  {shop.total_orders ? ` • 📦 ${shop.total_orders}` : ''}
                </div>
                {shop.rejection_reason && shop.rejection_reason !== 'BLOCKED' && (
                  <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: 4, background: '#fef2f2', padding: '4px 8px', borderRadius: 4 }}>
                    Reason: {shop.rejection_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Documents ── */}
      {documents.length > 0 && (
        <Card title="Registration Documents" icon="📄">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {documents.map(doc => (
              <div key={doc.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{doc.shop_name || 'Document Submission'}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{fmtDate(doc.created_at)}</div>
                  </div>
                  <span style={{
                    padding: '2px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700,
                    background: doc.status === 'approved' ? '#dcfce7' : doc.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                    color: doc.status === 'approved' ? '#16a34a' : doc.status === 'rejected' ? '#dc2626' : '#d97706'
                  }}>
                    {doc.status}
                  </span>
                </div>
                {doc.rejection_reason && (
                  <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: 6 }}>❌ {doc.rejection_reason}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Order Stats ── */}
      <Card title="Order Summary" icon="📊" accent="#fef3c7">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            { label: 'Total Orders', value: String(orderCounts.total), color: '#1e293b' },
            { label: 'Delivered', value: String(orderCounts.delivered), color: '#16a34a' },
            { label: 'Pending', value: String(orderCounts.pending), color: '#d97706' },
            { label: 'Cancelled', value: String(orderCounts.cancelled), color: '#dc2626' },
          ].map(f => (
            <div key={f.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: f.color }}>{f.value}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 8 }}>
          <InfoRow label="Total Admin Revenue" value={`₹${totalRevenue.toFixed(0)}`} />
          <InfoRow label="Total Shop Earnings" value={`₹${totalShopEarnings.toFixed(0)}`} />
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
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '12px 0' }}>No orders yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
            {orders.map(o => (
              <div key={o.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>#<span>{o.order_number}</span></div>
                    <div style={{ fontSize: '0.72rem', color: '#f97316', fontWeight: 600 }}>🏪 {o.shop_name}</div>
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
                  <span>💵 Shop: <strong>₹{o.shopkeeper_earning?.toFixed(0)}</strong></span>
                  <span>💰 Admin: <strong>₹{o.admin_earning?.toFixed(0)}</strong></span>
                  <span>🚚 Agent: <strong>₹{o.agent_earning?.toFixed(0)}</strong></span>
                  {o.payment_method && <span>💳 {o.payment_method}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Subscriptions ── */}
      {subscriptions.length > 0 && (
        <Card title="Subscriptions" icon="📋" accent="#dcfce7">
          {subscriptions.map(sub => (
            <div key={sub.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {sub.subscription_plans?.name || 'Plan'} — {sub.status}
                </div>
                <span style={{
                  padding: '2px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700,
                  background: sub.status === 'active' ? '#dcfce7' : '#fef3c7',
                  color: sub.status === 'active' ? '#16a34a' : '#d97706'
                }}>
                  {sub.status}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                {sub.subscription_plans?.price ? `₹${sub.subscription_plans.price}` : ''}
                {sub.subscription_plans?.duration_days ? ` / ${sub.subscription_plans.duration_days} days` : ''}
                {sub.start_date ? ` • Started ${fmtDate(sub.start_date)}` : ''}
                {sub.end_date ? ` • Ends ${fmtDate(sub.end_date)}` : ''}
              </div>
              {sub.auto_renew && <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: 2 }}>🔄 Auto-renew on</div>}
            </div>
          ))}
        </Card>
      )}

      <style>{`
        .sk-container { max-width: 720px; margin: 0 auto; padding: 4px 0; }
        .sk-header {
          background: linear-gradient(135deg, #fff7ed, #fef3c7);
          border-radius: 16px;
          padding: 20px 24px;
          margin-bottom: 16px;
          border: 1.5px solid #fed7aa;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 12px;
        }
        .sk-header-name { font-weight: 900; font-size: 1.4rem; color: #ea580c; }
        .sk-header-meta { font-size: 0.82rem; color: #78716c; margin-top: 4px; }
        .sk-status {
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 0.82rem;
          white-space: nowrap;
        }
        .sk-status-active { background: #dcfce7; color: #16a34a; border: 1.5px solid #bbf7d0; }
        .sk-status-inactive { background: #f1f5f9; color: #64748b; border: 1.5px solid #e2e8f0; }
        @media (max-width: 640px) {
          .sk-header { padding: 16px; }
          .sk-header-name { font-size: 1.2rem; }
        }
      `}</style>
    </div>
  )
}
