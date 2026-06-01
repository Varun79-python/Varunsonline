'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  deleteShopkeeperShop,
  blockShopkeeperShop,
  unblockShopkeeperShop,
  toggleShopActive,
  reapproveShopRecord,
} from '@/app/admin/actions'

// ── Types ──
interface ShopProduct {
  id: string; name: string; image_url: string | null; price: number
  stock: number | null; unit: string | null; rating: number; rating_count: number
  is_available: boolean; created_at: string
}

interface ShopOrder {
  id: string; order_number: string; status: string; total_amount: number
  subtotal: number; delivery_charge: number; platform_fee: number
  admin_earning: number; shopkeeper_earning: number; agent_earning: number
  payment_method: string; created_at: string; payment_confirmed_at: string | null
  delivered_at: string | null
}

interface SubscriptionPlan {
  name: string; price: number; duration_days: number; features: any
}

interface SubscriptionInfo {
  id: string; plan_id: string; status: string; start_date: string
  end_date: string; auto_renew: boolean; created_at: string
  plan: SubscriptionPlan | null
}

interface SubPayment {
  id: string; amount_paid: number; payment_method: string
  status: string; created_at: string
}

interface ShopDetailData {
  shop: Record<string, any>
  owner: Record<string, any> | null
  products: ShopProduct[]
  orders: ShopOrder[]
  orderCounts: { total: number; delivered: number; cancelled: number; pending: number }
  totalRevenue: number
  totalShopEarnings: number
  subscription: SubscriptionInfo | null
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

export default function AdminShopDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<ShopDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      const res = await fetch(`/api/admin/shop-detail/${id}`, { headers })
      const json = await res.json()
      if (json.error) setError(json.error)
      else setData(json)
    } catch {
      setError('Failed to load shop details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [id])

  async function handleToggleActive() {
    if (!data) return
    setProcessing(true)
    const res = await toggleShopActive(id, data.shop.is_active)
    if (res.error) alert('Toggle failed: ' + res.error)
    else { await loadData() }
    setProcessing(false)
  }

  async function handleBlock() {
    if (!data || !confirm(`Block ${data.shop.name}?`)) return
    setProcessing(true)
    const res = await blockShopkeeperShop(data.shop.owner_id)
    if (res.error) alert('Block failed: ' + res.error)
    else { alert('Shop blocked'); await loadData() }
    setProcessing(false)
  }

  async function handleUnblock() {
    if (!data || !confirm(`Unblock ${data.shop.name}?`)) return
    setProcessing(true)
    const res = await unblockShopkeeperShop(data.shop.owner_id)
    if (res.error) alert('Unblock failed: ' + res.error)
    else { alert('Shop unblocked'); await loadData() }
    setProcessing(false)
  }

  async function handleReapprove() {
    if (!data || !confirm(`Re-approve ${data.shop.name}?`)) return
    setProcessing(true)
    const res = await reapproveShopRecord({
      id, type: 'shop', user_id: data.shop.owner_id, name: data.shop.name
    })
    if (res.error) alert('Re-approve failed: ' + res.error)
    else { await loadData() }
    setProcessing(false)
  }

  async function handleDelete() {
    if (!data) return
    if (!confirm(`⚠️ WARNING: Delete ${data.shop.name}?\nThis permanently deletes their shop, products, orders, and documents.`)) return
    setProcessing(true)
    const res = await deleteShopkeeperShop(data.shop.owner_id)
    if (res.error) alert('Delete failed: ' + res.error)
    else {
      alert('Shop deleted successfully.')
      router.push('/admin/shops')
    }
    setProcessing(false)
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
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (error || !data) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: '#ef4444', fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>❌ Error</div>
      <div style={{ color: '#64748b', marginBottom: 16 }}>{error || 'Shop not found'}</div>
      <button onClick={() => router.push('/admin')} style={{ padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>← Go Back</button>
    </div>
  )

  const { shop, owner, products, orders, orderCounts, totalRevenue, totalShopEarnings, subscription, subPayments } = data
  const isBlocked = shop.rejection_reason === 'BLOCKED'

  return (
    <div className="sd-container">
      {/* Back */}
      <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', marginBottom: 18, padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Command Center
      </button>

      {/* ── Header ── */}
      <div className="sd-header">
        <div>
          <div className="sd-header-name">{shop.name || 'Unnamed Shop'}</div>
          <div className="sd-header-meta">
            {shop.category} • {shop.city} • Created {fmtDate(shop.created_at)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`sd-status ${isBlocked ? 'sd-status-blocked' : shop.is_active ? (shop.is_open ? 'sd-status-open' : 'sd-status-closed') : 'sd-status-inactive'}`}>
            {isBlocked ? '🚫 BLOCKED' : shop.is_active ? (shop.is_open ? '🟢 OPEN' : '🔴 CLOSED') : '⏸️ INACTIVE'}
          </span>
        </div>
      </div>

      {/* ── Shop Info ── */}
      <Card title="Shop Information" icon="🏪">
        {shop.shop_image_url && (
          <div style={{ marginBottom: 14 }}>
            <img src={shop.shop_image_url} alt={shop.name} style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }} />
          </div>
        )}
        <InfoRow label="Shop Name" value={shop.name} />
        <InfoRow label="Category" value={shop.category} />
        <InfoRow label="City" value={shop.city} />
        <InfoRow label="Address" value={shop.address_line1} />
        <InfoRow label="Landmark" value={shop.landmark} />
        <InfoRow label="Description" value={shop.description} />
        <InfoRow label="GPS Coordinates" value={shop.latitude ? `${Number(shop.latitude).toFixed(5)}, ${Number(shop.longitude).toFixed(5)}` : null} />
        <InfoRow label="Open Status" value={shop.is_open ? '🟢 Open' : '🔴 Closed'} />
        <InfoRow label="Rating" value={shop.rating ? `⭐ ${Number(shop.rating).toFixed(1)}` : null} />
        <InfoRow label="Total Orders" value={shop.total_orders ? `📦 ${shop.total_orders}` : '0'} />
        <InfoRow label="Rejection Reason" value={shop.rejection_reason} />
      </Card>

      {/* ── Owner Info ── */}
      <Card title="Owner / Personal Info" icon="👤">
        <InfoRow label="Full Name" value={owner?.full_name || shop.full_name} />
        <InfoRow label="Phone" value={owner?.phone || shop.phone} />
        <InfoRow label="Email" value={owner?.email || shop.email} />
        {owner?.created_at && <InfoRow label="Joined" value={fmtDate(owner.created_at)} />}
        <InfoRow label="Owner ID" value={shop.owner_id} mono />
      </Card>

      {/* ── Financials ── */}
      <Card title="Financials & Payout Details" icon="💰" accent="#fef3c7">
        <InfoRow label="UPI ID" value={shop.upi_id} />
        <InfoRow label="Bank Account" value={shop.bank_account_number} />
        <InfoRow label="Bank IFSC" value={shop.bank_ifsc} />
        <div style={{ borderTop: '2px solid #e2e8f0', marginTop: 8, paddingTop: 8 }}>
          <InfoRow label="Total Admin Revenue" value={`₹${totalRevenue.toFixed(0)}`} />
          <InfoRow label="Total Shop Earnings" value={`₹${totalShopEarnings.toFixed(0)}`} />
        </div>
      </Card>

      {/* ── Subscription ── */}
      <Card title="Subscription" icon="📋" accent={subscription?.status === 'active' ? '#dcfce7' : '#fef3c7'}>
        {subscription ? (
          <>
            <InfoRow label="Plan" value={subscription.plan?.name || 'N/A'} />
            <InfoRow label="Plan Price" value={subscription.plan?.price ? `₹${subscription.plan.price}` : null} />
            <InfoRow label="Duration" value={subscription.plan?.duration_days ? `${subscription.plan.duration_days} days` : null} />
            <InfoRow label="Status" value={subscription.status} />
            <InfoRow label="Start Date" value={fmtDate(subscription.start_date)} />
            <InfoRow label="End Date" value={fmtDate(subscription.end_date)} />
            <InfoRow label="Auto Renew" value={subscription.auto_renew ? '✅ Yes' : '❌ No'} />
            {subscription.plan?.features && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Features:</div>
                {Array.isArray(subscription.plan.features)
                  ? subscription.plan.features.map((f: string, i: number) => (
                      <div key={i} style={{ padding: '2px 0' }}>• {f}</div>
                    ))
                  : typeof subscription.plan.features === 'string'
                    ? <div>{subscription.plan.features}</div>
                    : <div>{JSON.stringify(subscription.plan.features)}</div>
                }
              </div>
            )}
            {/* Subscription Payments */}
            {subPayments.length > 0 && (
              <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#64748b', marginBottom: 8 }}>Payment History</div>
                {subPayments.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>{fmtDate(p.created_at)}</span>
                    <span style={{ fontWeight: 600 }}>₹{p.amount_paid}</span>
                    <span style={{ color: p.status === 'completed' ? '#16a34a' : '#d97706' }}>{p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '12px 0' }}>No active subscription plan</p>
        )}
      </Card>

      {/* ── Products ── */}
      <Card title={`Products (${products.length})`} icon="🛍️">
        {products.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '12px 0' }}>No products added yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {products.map((p, idx) => (
              <div key={p.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: idx < products.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} loading="lazy" decoding="async" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 44, height: 44, background: '#fff7ed', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📦</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    ₹{p.price}{p.unit ? ` / ${p.unit}` : ''} • {p.is_available ? '✅ Available' : '❌ Unavailable'} • Stock: {p.stock ?? '∞'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#f97316' }}>₹{p.price}</div>
                  {p.rating > 0 && (
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>⭐ {p.rating.toFixed(1)} ({p.rating_count})</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Orders ── */}
      <Card title={`Orders (${orderCounts.total})`} icon="📦">
        {/* Order summary chips */}
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
                  {o.payment_method && <span>💳 {o.payment_method}</span>}
                  {o.delivery_charge > 0 && <span>🚚 ₹{o.delivery_charge}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Actions ── */}
      <Card title="Admin Actions" icon="⚙️" accent="#e2e8f0">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shop.is_approved && !isBlocked && (
            <button onClick={handleToggleActive} disabled={processing} className="sd-action-btn" style={{ background: shop.is_active ? '#fef3c7' : '#dcfce7', color: shop.is_active ? '#d97706' : '#16a34a' }}>
              {shop.is_active ? '⏸️ Pause Shop' : '▶️ Activate Shop'}
            </button>
          )}
          {isBlocked ? (
            <button onClick={handleUnblock} disabled={processing} className="sd-action-btn" style={{ background: '#dcfce7', color: '#16a34a' }}>
              🔓 Unblock Shop
            </button>
          ) : shop.is_approved && (
            <button onClick={handleBlock} disabled={processing} className="sd-action-btn" style={{ background: '#fee2e2', color: '#dc2626' }}>
              🚫 Block Shop
            </button>
          )}
          {shop.is_approved && !shop.is_active && !isBlocked && (
            <button onClick={handleReapprove} disabled={processing} className="sd-action-btn" style={{ background: '#16a34a', color: 'white' }}>
              ✅ Reapprove & Activate
            </button>
          )}
          <button onClick={handleDelete} disabled={processing} className="sd-action-btn" style={{ background: '#be123c', color: 'white' }}>
            🗑️ Delete Shop Permanently
          </button>
        </div>
      </Card>
      
      <style>{`
        .sd-container { max-width: 720px; margin: 0 auto; padding: 4px 0; }
        .sd-header {
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
        .sd-header-name { font-weight: 900; font-size: 1.4rem; color: #ea580c; }
        .sd-header-meta { font-size: 0.82rem; color: #78716c; margin-top: 4px; }
        .sd-status {
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 0.82rem;
          white-space: nowrap;
        }
        .sd-status-open { background: #dcfce7; color: #16a34a; border: 1.5px solid #bbf7d0; }
        .sd-status-closed { background: #fef3c7; color: #d97706; border: 1.5px solid #fed7aa; }
        .sd-status-inactive { background: #f1f5f9; color: #64748b; border: 1.5px solid #e2e8f0; }
        .sd-status-blocked { background: #fee2e2; color: #dc2626; border: 1.5px solid #fecaca; }
        .sd-action-btn {
          border: none;
          border-radius: 12px;
          padding: 14px 20px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }
        .sd-action-btn:hover { opacity: 0.85; }
        .sd-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        @media (max-width: 640px) {
          .sd-header { padding: 16px; }
          .sd-header-name { font-size: 1.2rem; }
        }
      `}</style>
    </div>
  )
}
