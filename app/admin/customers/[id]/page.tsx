'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Types ──
interface CustomerProfile {
  id: string; full_name: string | null; email: string | null; phone: string | null
  gender: string | null; avatar_url: string | null; is_active: boolean
  created_at: string
}

interface Address {
  id: string; label: string | null; house_name: string; street_name: string
  landmark: string | null; city: string | null; state: string | null
  pincode: string | null; latitude: number | null; longitude: number | null
  is_default: boolean; phone: string | null; created_at: string
}

interface OrderItem {
  id: string; product_name: string; quantity: number; price: number
  image_url: string | null; unit: string | null
}

interface Order {
  id: string; order_number: string; status: string; total_amount: number
  subtotal: number; delivery_charge: number; platform_fee: number
  discount_amount: number; admin_earning: number; shopkeeper_earning: number
  agent_earning: number; payment_method: string; payment_status: string
  shop_name: string; created_at: string; delivered_at: string | null
  items: OrderItem[]; delivery_address: Address | null
}

interface CustomerDetail {
  profile: CustomerProfile
  addresses: Address[]
  orders: Order[]
  orderCounts: { total: number; delivered: number; cancelled: number; pending: number }
  totalSpent: number
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

export default function AdminCustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      const res = await fetch(`/api/admin/customer-detail/${id}`, { headers })
      const json = await res.json()
      if (json.error) setError(json.error); else setData(json)
    } catch { setError('Failed to load customer details') }
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
      <div style={{ color: '#64748b', marginBottom: 16 }}>{error || 'Customer not found'}</div>
      <button onClick={() => router.push('/admin')} style={{ padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>← Go Back</button>
    </div>
  )

  const { profile, addresses, orders, orderCounts, totalSpent } = data

  return (
    <div className="cd-container">
      {/* Back */}
      <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', marginBottom: 18, padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Command Center
      </button>

      {/* ── Header ── */}
      <div className="cd-header">
        <div>
          <div className="cd-header-name">{profile.full_name || 'Unnamed Customer'}</div>
          <div className="cd-header-meta">
            {profile.email || 'No email'} • {profile.phone || 'No phone'} • Joined {fmtDate(profile.created_at)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`cd-status ${profile.is_active ? 'cd-status-active' : 'cd-status-inactive'}`}>
            {profile.is_active ? '🟢 Active' : '🔴 Inactive'}
          </span>
        </div>
      </div>

      {/* ── Profile Info ── */}
      <Card title="Profile Information" icon="👤">
        <InfoRow label="Full Name" value={profile.full_name} />
        <InfoRow label="Email" value={profile.email} />
        <InfoRow label="Phone" value={profile.phone} />
        <InfoRow label="Gender" value={profile.gender} />
        <InfoRow label="Customer ID" value={profile.id} mono />
        <InfoRow label="Joined" value={fmtDate(profile.created_at)} />
        <InfoRow label="Last Updated" value={fmtDate((profile as any).updated_at)} />
      </Card>

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
        <InfoRow label="Total Amount Spent" value={`₹${totalSpent.toFixed(0)}`} />
      </Card>

      {/* ── Addresses ── */}
      <Card title={`Addresses (${addresses.length})`} icon="📍">
        {addresses.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '12px 0' }}>No addresses saved</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {addresses.map((addr, idx) => (
              <div key={addr.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', border: addr.is_default ? '1.5px solid #f97316' : '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    {addr.label || `Address ${idx + 1}`}
                    {addr.is_default && <span style={{ color: '#f97316', fontSize: '0.7rem', marginLeft: 6 }}>★ Default</span>}
                  </div>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                  {addr.house_name}, {addr.street_name}
                  {addr.landmark ? `, ${addr.landmark}` : ''}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                  {[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
                </div>
                {addr.phone && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>📱 {addr.phone}</div>}
                {addr.latitude && addr.longitude && (
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
                    📍 {Number(addr.latitude).toFixed(5)}, {Number(addr.longitude).toFixed(5)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.map(o => (
              <div key={o.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>#<span>{o.order_number}</span></div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{fmt(o.created_at)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>₹{o.total_amount}</div>
                    <span style={{
                      fontSize: '0.68rem', padding: '2px 8px', borderRadius: 99,
                      background: o.status === 'delivered' ? '#dcfce7' : o.status === 'cancelled' || o.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                      color: o.status === 'delivered' ? '#16a34a' : o.status === 'cancelled' || o.status === 'rejected' ? '#dc2626' : '#d97706',
                      display: 'inline-block', marginTop: 2
                    }}>{o.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                {/* Shop name */}
                <div style={{ fontSize: '0.78rem', color: '#f97316', fontWeight: 600, marginBottom: 6 }}>
                  🏪 {o.shop_name}
                </div>

                {/* Order items */}
                {o.items.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    {o.items.map((item, i) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '2px 0', borderBottom: i < o.items.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                        <span style={{ color: '#475569' }}>
                          {item.product_name} × {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                        </span>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>₹{Number(item.price * item.quantity).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Delivery address */}
                {o.delivery_address && (
                  <div style={{ fontSize: '0.72rem', color: '#64748b', padding: '6px 8px', background: '#fff7ed', borderRadius: 6, marginBottom: 6 }}>
                    📍 Deliver to: {o.delivery_address.house_name}, {o.delivery_address.street_name}
                    {o.delivery_address.city ? `, ${o.delivery_address.city}` : ''}
                    {o.delivery_address.phone ? ` • 📱 ${o.delivery_address.phone}` : ''}
                  </div>
                )}

                {/* Earnings breakdown */}
                <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem', color: '#64748b', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
                  <span>💰 Admin: <strong>₹{o.admin_earning?.toFixed(0)}</strong></span>
                  <span>🏪 Shop: <strong>₹{o.shopkeeper_earning?.toFixed(0)}</strong></span>
                  <span>💵 Agent: <strong>₹{o.agent_earning?.toFixed(0)}</strong></span>
                  {o.payment_method && <span>💳 {o.payment_method}</span>}
                  {o.delivery_charge > 0 && <span>🚚 ₹{o.delivery_charge}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <style>{`
        .cd-container { max-width: 720px; margin: 0 auto; padding: 4px 0; }
        .cd-header {
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
        .cd-header-name { font-weight: 900; font-size: 1.4rem; color: #ea580c; }
        .cd-header-meta { font-size: 0.82rem; color: #78716c; margin-top: 4px; }
        .cd-status {
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 0.82rem;
          white-space: nowrap;
        }
        .cd-status-active { background: #dcfce7; color: #16a34a; border: 1.5px solid #bbf7d0; }
        .cd-status-inactive { background: #f1f5f9; color: #64748b; border: 1.5px solid #e2e8f0; }
        @media (max-width: 640px) {
          .cd-header { padding: 16px; }
          .cd-header-name { font-size: 1.2rem; }
        }
      `}</style>
    </div>
  )
}
