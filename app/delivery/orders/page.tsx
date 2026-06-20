'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/modules/infrastructure/supabase/client'
import { SkeletonBlock } from '@/modules/shared-ui/components/ui/skeleton'
import { type RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useOrderAlert } from '@/modules/notifications/hooks/useOrderAlert'

interface AvailableOrder {
  id: string; order_number: string; status: string; agent_earning: number
  total_amount: number; created_at: string; delivery_charge: number
  payment_method: string
  shops: { name: string; address_line1: string; city: string; latitude: number; longitude: number }
  addresses: { house_name: string; street_name: string; city: string; landmark: string; latitude: number; longitude: number }
  distAgentToShop: number | null
  distShopToCustomer: number | null
  order_items?: { product_name: string; quantity: number; product_image_url?: string }[]
}
interface MyOrder {
  id: string; order_number: string; status: string; agent_earning: number
  total_amount: number; created_at: string; delivery_charge: number
  payment_method: string
  shops: { name: string; city: string }
  addresses: { house_name: string; street_name: string; city: string }
}

const STATUS_LABELS: Record<string, string> = {
  agent_assigned: 'Assigned', picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered',
  cancelled: 'Cancelled', rejected: 'Rejected'
}
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  agent_assigned: { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
  picked_up: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
  out_for_delivery: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  delivered: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  cancelled: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  rejected: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' }
}

export default function DeliveryOrdersPage() {
  const supabase = createClient()
  const router = useRouter()
  const { start: startAlert, stop: stopAlert } = useOrderAlert()
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([])
  const [availableLoading, setAvailableLoading] = useState(true)
  const [myOrders, setMyOrders] = useState<MyOrder[]>([])
  const [myOrdersLoading, setMyOrdersLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active')
  const [agentId, setAgentId] = useState<string | null>(null)
  const [gpsWarning, setGpsWarning] = useState(false)
  const [missedOrders, setMissedOrders] = useState<Set<string>>(new Set())
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set())
  const [highlightNew, setHighlightNew] = useState<string | null>(null)
  const prevAvailableCount = useRef(0)

  const [fetchError, setFetchError] = useState<string | null>(null)
  const [acceptError, setAcceptError] = useState<string | null>(null)



  // Load available orders (unassigned, packed, within 5km)
  async function loadAvailable() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    try {
      const res = await fetch('/api/delivery/orders', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (!res.ok) {
        setFetchError(`Failed to load orders (${res.status})`)
        setAvailableLoading(false)
        return
      }
      const json = await res.json()
      // Filter out already-accepted orders
      const filtered = (json.orders || []).filter((o: AvailableOrder) =>
        !acceptedIds.has(o.id) && !missedOrders.has(o.id)
      )
      // Highlight new orders
      if (filtered.length > prevAvailableCount.current && prevAvailableCount.current > 0) {
        const newOrder = filtered[0]
        setHighlightNew(newOrder.id)
        setTimeout(() => setHighlightNew(null), 4000)
      }
      prevAvailableCount.current = filtered.length
      setAvailableOrders(filtered)
      setGpsWarning(json.gpsRequired || false)
      setFetchError(null)
    } catch (err) {
      console.error('[delivery-orders] loadAvailable error:', err)
      setFetchError('Network error loading orders. Pull down to retry.')
    }
    setAvailableLoading(false)
  }

  // Load my assigned orders
  async function loadMyOrders() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      let q = supabase.from('orders')
        .select('*, shops(name, city), addresses(house_name, street_name, city)')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (activeTab === 'active') q = q.in('status', ['agent_assigned', 'picked_up', 'out_for_delivery'])
      else if (activeTab === 'completed') q = q.eq('status', 'delivered')
      else if (activeTab === 'cancelled') q = q.in('status', ['cancelled', 'rejected'])
      const { data, error } = await q
      if (error) {
        console.error('[delivery-orders] loadMyOrders error:', error)
        setFetchError(error.message)
      } else {
        setMyOrders(data || [])
        setFetchError(null)
      }
    } catch (err) {
      console.error('[delivery-orders] loadMyOrders error:', err)
      setFetchError('Network error loading your orders.')
    }
    setMyOrdersLoading(false)
  }

  // Accept an order atomically
  async function acceptOrder(orderId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setAcceptError(null)
    try {
      const res = await fetch('/api/delivery/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId })
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        setAcceptError(errJson.error || `Failed to accept order (${res.status})`)
        return
      }
      const json = await res.json()
      if (json.success) {
        setAcceptedIds(prev => new Set([...prev, orderId]))
        setAvailableOrders(prev => prev.filter(o => o.id !== orderId))
        // Reload my orders to show newly accepted
        loadMyOrders()
      } else if (json.alreadyClaimed) {
        setMissedOrders(prev => new Set([...prev, orderId]))
        setAvailableOrders(prev => prev.filter(o => o.id !== orderId))
      }
    } catch (err) {
      console.error('[delivery-orders] acceptOrder error:', err)
      setAcceptError('Network error. Please try again.')
    }
  }

  // Realtime subscription for available orders
  useEffect(() => {
    const ch = supabase.channel('delivery-available-orders')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: 'status=eq.shop_accepted' },
        () => { loadAvailable() }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: 'status=eq.order_packed' },
        () => { loadAvailable() }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'status=eq.agent_assigned' },
        (payload: RealtimePostgresChangesPayload<{ id: string; agent_id: string }>) => {
          const updated = payload.new as { id: string; agent_id: string }
          // If this order was claimed by someone else, remove from available list
          setAvailableOrders(prev => prev.filter(o => o.id !== updated.id))
          setMissedOrders(prev => new Set([...prev, updated.id]))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Fetch and set agentId on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: { id: string } | null } }) => {
      if (user) setAgentId(user.id)
    })
  }, [])

  // Realtime update for my orders
  useEffect(() => {
    if (!agentId) return

    const channel = supabase.channel(`dl-my-orders-realtime-${agentId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `agent_id=eq.${agentId}` },
        () => { loadMyOrders() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [agentId])

  useEffect(() => {
    loadMyOrders()
  }, [activeTab])

  useEffect(() => {
    loadAvailable()
    const interval = setInterval(loadAvailable, 15000)
    return () => clearInterval(interval)
  }, [])

  const totalEarned = myOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.agent_earning || 0), 0)

  return (
    <div className="fade-in" style={{ padding: '0 12px' }}>
      {/* ── AVAILABLE ORDERS SECTION ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>🔥 Available Orders</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { startAlert(); setTimeout(stopAlert, 2000) }} style={{ padding: '6px 14px', background: '#0284c7', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>🔊 Test Alarm</button>
            <button onClick={loadAvailable} style={{ padding: '6px 14px', background: '#f97316', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>🔄 Refresh</button>
          </div>
        </div>
        {gpsWarning && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
            ⚠️ Enable GPS to see orders near you
          </div>
        )}
        {fetchError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
            ❌ {fetchError}
          </div>
        )}
        {availableLoading && <SkeletonBlock lines={2} gap={10} />}
        {!availableLoading && availableOrders.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: '2rem', marginBottom: 6 }}>🛵</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No orders available nearby. Check back soon!</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {availableOrders.map(o => (
            <div
              key={o.id}
              className={`avail-card ${highlightNew === o.id ? 'avail-highlight' : ''}`}
              style={{ border: highlightNew === o.id ? '2px solid #f97316' : '1.5px solid var(--border)' }}
            >
              {/* New badge */}
              {highlightNew === o.id && (
                <div style={{ background: '#f97316', color: 'white', fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4, display: 'inline-block', marginBottom: 6 }}>
                  🔥 NEW ORDER
                </div>
              )}
              {/* Shop Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>🏪 {o.shops?.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {o.shops?.address_line1}, {o.shops?.city}
                  </div>
                  {o.distAgentToShop != null && (
                    <div style={{ fontSize: '0.75rem', color: '#f97316', fontWeight: 600 }}>
                      📍 {o.distAgentToShop < 1 ? `${Math.round(o.distAgentToShop * 1000)}m` : `${o.distAgentToShop.toFixed(1)}km`} from you
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a' }}>₹{o.total_amount}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Earn +₹{o.agent_earning}</div>
                </div>
              </div>
              {/* Customer Info */}
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                📬 {o.addresses?.house_name}, {o.addresses?.city}
                {o.distShopToCustomer != null && (
                  <span style={{ color: '#0ea5e9' }}> (shop→cust: {o.distShopToCustomer < 1 ? `${Math.round(o.distShopToCustomer * 1000)}m` : `${o.distShopToCustomer.toFixed(1)}km`})</span>
                )}
              </div>
              {/* Payment type badge */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <span style={{ background: o.payment_method === 'cod' ? '#fef3c7' : '#dcfce7', color: o.payment_method === 'cod' ? '#d97706' : '#16a34a', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                  {o.payment_method === 'cod' ? '💵 COD' : '💳 Online'}
                </span>
                <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                  🛍️ {(o as any).order_items?.length || 0} items
                </span>
              </div>
              {/* Accept Button */}
              {acceptError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>
                  ❌ {acceptError}
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); acceptOrder(o.id) }}
                style={{ width: '100%', padding: 12, background: '#f97316', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                🛵 Accept Order
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── MY ORDERS SECTION ── */}
      <h3 style={{ marginBottom: 12, fontSize: '1.1rem', fontWeight: 800 }}>📋 My Orders</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a' }}>{myOrders.filter(o => o.status === 'delivered').length}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Delivered</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f97316' }}>₹{totalEarned}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Earned</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0ea5e9' }}>{myOrders.filter(o => ['agent_assigned','picked_up','out_for_delivery'].includes(o.status)).length}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Active</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['active', 'completed', 'cancelled'].map(tabId => (
          <button key={tabId} onClick={() => setActiveTab(tabId)} style={{
            flex: 1, padding: '10px 8px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700,
            cursor: 'pointer', border: '1.5px solid',
            borderColor: activeTab === tabId ? '#22c55e' : 'var(--border)',
            background: activeTab === tabId ? 'rgba(34,197,94,0.1)' : 'transparent',
            color: activeTab === tabId ? '#16a34a' : 'var(--text-muted)'
          }}>{tabId.charAt(0).toUpperCase() + tabId.slice(1)}</button>
        ))}
      </div>

      {myOrdersLoading && <SkeletonBlock lines={3} gap={10} />}
      {!myOrdersLoading && myOrders.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: '2rem', marginBottom: 6 }}>📭</div>
          <p style={{ color: 'var(--text-muted)' }}>No orders found</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 80 }}>
        {myOrders.map(o => {
          const colors = STATUS_COLORS[o.status] || STATUS_COLORS.delivered
          return (
            <div key={o.id} className="dl-order-card" onClick={() => router.push(`/delivery/orders/${o.id}`)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>#{o.order_number}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                  {STATUS_LABELS[o.status] || o.status}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                🏪 {o.shops?.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                📍 {o.addresses?.house_name}, {o.addresses?.city}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.85rem' }}>+₹{o.agent_earning || 0}</span>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        .dl-order-card { background: white; border: 1.5px solid var(--border); border-radius: 12px; padding: 14px; }
        .avail-card { background: white; border-radius: 12px; padding: 14px; transition: all 0.3s ease; }
        .avail-highlight {
          animation: pulseGlow 2s ease-in-out;
          box-shadow: 0 0 20px rgba(249,115,22,0.3);
        }
        @keyframes pulseGlow {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(249,115,22,0); }
          50% { transform: scale(1.02); box-shadow: 0 0 30px rgba(249,115,22,0.5); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(249,115,22,0); }
        }
      `}</style>
    </div>
  )
}
