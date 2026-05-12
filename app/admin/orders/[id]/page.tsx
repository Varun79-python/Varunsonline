'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STATUS_STEPS = [
  { key: 'payment_confirmed', label: 'Payment Confirmed', icon: '💳' },
  { key: 'shop_accepted', label: 'Shop Accepted', icon: '🏪' },
  { key: 'order_packed', label: 'Order Packed', icon: '📦' },
  { key: 'agent_assigned', label: 'Agent Assigned', icon: '🛵' },
  { key: 'picked_up', label: 'Picked Up', icon: '🏃' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🚴' },
  { key: 'delivered', label: 'Delivered', icon: '🎉' },
]
const STATUS_RANK: Record<string, number> = { payment_confirmed: 1, shop_accepted: 2, order_packed: 3, agent_assigned: 4, picked_up: 5, out_for_delivery: 6, delivered: 7 }
const STATUS_COLOR: Record<string, string> = { delivered: '#22c55e', cancelled: '#ef4444', rejected: '#ef4444', out_for_delivery: '#0ea5e9', order_packed: '#f97316', shop_accepted: '#f97316', agent_assigned: '#8b5cf6', picked_up: '#8b5cf6', payment_confirmed: '#22c55e' }

function InfoRow({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', gap: 12 }}>
      <span style={{ color: '#64748b', fontSize: '0.85rem', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', textAlign: 'right', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '18px 20px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  )
}

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const authHeader: HeadersInit = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      fetch(`/api/admin/order-detail/${id}`, { headers: { ...authHeader } })
        .then(r => r.json())
        .then(d => { if (d.error) setError(d.error); else setData(d) })
        .catch(() => setError('Failed to load'))
        .finally(() => setLoading(false))
    }
    load()
  }, [id, supabase])

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} /></div>
  if (error || !data) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>❌ {error || 'Order not found'}</div>

  const order = data.order as Record<string, unknown>
  const items = data.items as Record<string, unknown>[]
  const customer = data.customer as Record<string, unknown> | null
  const address = data.address as Record<string, unknown> | null
  const agent = data.agent as Record<string, unknown> | null
  const shop = order.shops as Record<string, unknown> | null

  const status = order.status as string
  const rank = STATUS_RANK[status] || 0
  const isTerminal = ['delivered', 'cancelled', 'rejected'].includes(status)

  function fmt(dt: unknown) {
    if (!dt) return null
    return new Date(dt as string).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '4px 0' }}>
      {/* Back */}
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', marginBottom: 18, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Back to Orders
      </button>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #fff7ed, #fef3c7)', borderRadius: 16, padding: '20px 24px', marginBottom: 16, border: '1.5px solid #fed7aa' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.4rem', color: '#ea580c' }}>{order.order_number as string}</div>
            <div style={{ fontSize: '0.82rem', color: '#78716c', marginTop: 4 }}>Ordered: {fmt(order.created_at)}</div>
          </div>
          <span style={{
            padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: '0.82rem',
            background: `${STATUS_COLOR[status] || '#64748b'}18`,
            color: STATUS_COLOR[status] || '#64748b',
            border: `1.5px solid ${STATUS_COLOR[status] || '#64748b'}40`
          }}>
            {status.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Timeline */}
      {!['cancelled', 'rejected'].includes(status) && (
        <Card title="Order Progress" icon="📊">
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
            {STATUS_STEPS.map((step, idx) => {
              const done = rank >= idx + 1
              const active = rank === idx + 1
              return (
                <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 60, position: 'relative' }}>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div style={{ position: 'absolute', top: 16, left: '50%', right: '-50%', height: 2, background: done ? '#22c55e' : '#e2e8f0', zIndex: 0 }} />
                  )}
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: done ? '#22c55e' : active ? '#f97316' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', position: 'relative', zIndex: 1, border: active ? '3px solid #fed7aa' : 'none', flexShrink: 0 }}>
                    {done ? '✓' : step.icon}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: done || active ? '#1e293b' : '#94a3b8', textAlign: 'center', marginTop: 4, lineHeight: 1.3, fontWeight: done || active ? 600 : 400 }}>
                    {step.label}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Customer */}
      <Card title="Customer Details" icon="👤">
        <InfoRow label="Name" value={customer?.full_name as string} />
        <InfoRow label="Phone" value={customer?.phone as string} />
        <InfoRow label="Email" value={customer?.email as string} />
        {address && (
          <>
            <InfoRow label="House / Building" value={address.house_name as string} />
            <InfoRow label="Street" value={address.street_name as string} />
            {address.landmark && <InfoRow label="Landmark" value={`Near ${address.landmark}`} />}
            <InfoRow label="City" value={address.city as string} />
            <InfoRow label="Delivery Phone" value={address.phone as string} />
          </>
        )}
      </Card>

      {/* Shop */}
      <Card title="Shop Details" icon="🏪">
        <InfoRow label="Shop Name" value={shop?.name as string} />
        <InfoRow label="Phone" value={shop?.phone as string} />
        <InfoRow label="Address" value={[shop?.address_line1, shop?.city].filter(Boolean).join(', ')} />
      </Card>

      {/* Delivery Agent */}
      {agent ? (
        <Card title="Delivery Agent" icon="🛵">
          <InfoRow label="Name" value={agent.full_name as string} />
          <InfoRow label="Phone" value={agent.phone as string} />
          <InfoRow label="Vehicle" value={`${agent.vehicle_type} — ${agent.vehicle_number}`} />
          <InfoRow label="Earnings" value={`₹${order.agent_earning || 0}`} />
        </Card>
      ) : (
        <Card title="Delivery Agent" icon="🛵">
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, textAlign: 'center', padding: '8px 0' }}>Not yet assigned</p>
        </Card>
      )}

      {/* Items */}
      <Card title={`Order Items (${items.length})`} icon="🛍️">
        {items.map((item, idx) => (
          <div key={item.id as string} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: idx < items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            {item.product_image_url
              ? <img src={item.product_image_url as string} alt={item.product_name as string} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 44, height: 44, background: '#fff7ed', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📦</div>
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{item.product_name as string}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>₹{item.unit_price as number} × {item.quantity as number}</div>
            </div>
            <div style={{ fontWeight: 700, color: '#f97316' }}>₹{item.total_price as number}</div>
          </div>
        ))}
      </Card>

      {/* Timeline of times */}
      <Card title="Order Timeline" icon="🕐">
        <InfoRow label="Order Placed" value={fmt(order.created_at)} />
        <InfoRow label="Payment Confirmed" value={fmt(order.payment_confirmed_at)} />
        <InfoRow label="Shop Accepted" value={fmt(order.accepted_at)} />
        <InfoRow label="Packed" value={fmt(order.packed_at)} />
        <InfoRow label="Picked Up" value={fmt(order.picked_up_at)} />
        <InfoRow label="Delivered" value={fmt(order.delivered_at)} />
        {!!(order.otp_verified) && <InfoRow label="OTP Verified" value="✅ Yes" />}
      </Card>

      {/* Payment */}
      <Card title="Payment Breakdown" icon="💰">
        <InfoRow label="Items Total" value={`₹${order.items_total || order.total_amount}`} />
        <InfoRow label="Delivery Charge" value={`₹${order.delivery_charge || 0}`} />
        <InfoRow label="Platform Fee" value={`₹${order.platform_fee || 0}`} />
        <div style={{ borderTop: '2px solid #e2e8f0', marginTop: 8, paddingTop: 8 }}>
          <InfoRow label="Grand Total" value={`₹${order.total_amount}`} />
          <InfoRow label="Admin Earning" value={`₹${order.admin_earning || 0}`} />
          <InfoRow label="Shop Payout" value={`₹${order.shop_earning || 0}`} />
          <InfoRow label="Agent Earning" value={`₹${order.agent_earning || 0}`} />
        </div>
        <InfoRow label="Payment Method" value={String(order.payment_method || '')} />
        <InfoRow label="Razorpay ID" value={String(order.razorpay_order_id || '')} mono />
      </Card>
    </div>
  )
}
