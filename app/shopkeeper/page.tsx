'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrderAlert } from '@/lib/useOrderAlert'
import { getShopkeeperShopData } from '@/app/admin/actions'

interface Shop { id: string; name: string; is_approved: boolean; is_active: boolean; is_open: boolean; is_profile_complete: boolean; wallet_balance: number; total_earnings: number; total_orders: number; rating: number; subscription_expires_at?: string | null; subscription_fee_percent?: number; rejection_reason?: string | null }
interface OrderItem { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_image_url: string }
interface Order {
  id: string; order_number: string; status: string; total_amount: number
  shopkeeper_earning: number; subtotal: number; created_at: string
  items: OrderItem[]; agent_id?: string | null; agent_name?: string | null
  rejection_reason?: string | null
}

const STATUS_BADGE: Record<string, { label: string; icon: string; bg: string; color: string; border: string }> = {
  payment_confirmed: { label: 'New Order', icon: '🔔', bg: '#fef3c7', color: '#d97706', border: '#fde68a' },
  shop_accepted:     { label: 'Accepted', icon: '✅', bg: '#dcfce7', color: '#16a34a', border: '#86efac' },
  order_packed:      { label: 'Packed', icon: '📦', bg: '#ffedd5', color: '#ea580c', border: '#fed7aa' },
  agent_assigned:    { label: 'Agent Assigned', icon: '🛵', bg: '#e0e7ff', color: '#4f46e5', border: '#c7d2fe' },
  picked_up:         { label: 'Picked Up', icon: '🏃', bg: '#e0e7ff', color: '#4f46e5', border: '#c7d2fe' },
  out_for_delivery:  { label: 'Out for Delivery', icon: '🚴', bg: '#dbeafe', color: '#2563eb', border: '#bfdbfe' },
  delivered:         { label: 'Delivered', icon: '🎉', bg: '#dcfce7', color: '#16a34a', border: '#86efac' },
  rejected:          { label: 'Rejected', icon: '❌', bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  cancelled:         { label: 'Cancelled', icon: '🚫', bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' },
}

export default function ShopkeeperDashboard() {
  const supabase = createClient()
  const [shop, setShop] = useState<Shop | null>(null)
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [todayEarnings, setTodayEarnings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [togglingOpen, setTogglingOpen] = useState(false)
  const shopIdRef = useRef<string | null>(null)
  // Track which order IDs are currently alerting (to stop when handled)
  const alertingOrdersRef = useRef<Set<string>>(new Set())
  const { start: startAlert, stop: stopAlert } = useOrderAlert()

  const [nowTime, setNowTime] = useState<number | null>(null)
  useEffect(() => { setNowTime(Date.now()) }, [])

  const alertingOrderIds = useMemo(() => {
    return new Set(alertingOrdersRef.current)
  }, [alertingOrdersRef.current.size])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  // Stop alert sound when all pending orders are handled
  function maybeStopAlert(remainingOrders: Order[]) {
    if (remainingOrders.length === 0) {
      stopAlert()
      alertingOrdersRef.current.clear()
    }
  }

  // Fetch pending orders + items via server API (bypasses RLS)
  const fetchPending = useCallback(async (shopId: string) => {
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`/api/shopkeeper/pending-orders?shopId=${shopId}`, { headers: { ...authHeader } })
      const data = await res.json()
      if (res.ok && data.orders) {
        setPendingOrders(data.orders)
      } else {
        setPendingOrders([])
      }
    } catch {
      setPendingOrders([])
    }
  }, [supabase])

  useEffect(() => {
    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) return

      // Use server action — bypasses RLS on shops table
      const { shop: shopData, userId: uid } = await getShopkeeperShopData()
      if (!mounted) return

      if (!shopData || !shopData.is_approved || !shopData.is_active) {
        // Not approved — redirect to the right step
        const { data: docs } = await supabase
          .from('shop_documents').select('status').eq('user_id', user?.id).maybeSingle()
        if (!docs) {
          window.location.replace('/login/shopkeeper/register/documents')
        } else {
          window.location.replace('/login/status')
        }
        return
      }
      
      setShop(shopData)
      shopIdRef.current = shopData.id

      // ── Subscription Expiry Check ──────────────────────────────
      // Check if fixed_monthly plan has expired; if so, deactivate shop instantly
      if (shopData.subscription_expires_at) {
        const expiry = new Date(shopData.subscription_expires_at)
        if (expiry < new Date() && shopData.is_active) {
          await supabase.from('shops').update({ is_active: false, subscription_plan_id: null, subscription_fee_percent: 0 }).eq('id', shopData.id)
          await supabase.from('shop_subscriptions').update({ is_active: false }).eq('shop_id', shopData.id).eq('is_active', true)
          setShop(s => s ? { ...s, is_active: false } : s)
          showToast('⚠️ Your subscription has expired. Please renew to accept orders.', 'error')
        }
      }
      // ────────────────────────────────────────────────────────────

      const today = new Date().toISOString().split('T')[0]
      const { data: todayOrders } = await supabase
        .from('orders').select('shopkeeper_earning')
        .eq('shop_id', shopData.id).eq('status', 'delivered').gte('created_at', today)
      setTodayEarnings(todayOrders?.reduce((s: number, o: { shopkeeper_earning: number }) => s + (o.shopkeeper_earning || 0), 0) || 0)

      await fetchPending(shopData.id)
      if (!mounted) return
      setLoading(false)

      // Realtime: listen for new orders
      channel = supabase.channel(`shop-incoming-${shopData.id}`)
      channel.on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'orders',
        filter: `shop_id=eq.${shopData.id}`
      }, async (payload: any) => {
        if (!mounted || !shopIdRef.current) return
        await fetchPending(shopIdRef.current)
        // Start looping alert — track by order id to prevent duplicate sounds
        const newOrderId = payload.new?.id as string | undefined
        if (newOrderId && !alertingOrdersRef.current.has(newOrderId)) {
          alertingOrdersRef.current.add(newOrderId)
          startAlert()
        }
        showToast('🔔 New Order Received!')
      }).subscribe()
    }

    loadData()
    return () => { mounted = false; if (channel) { supabase.removeChannel(channel); channel = null } }
  }, [fetchPending, supabase])

  // 5s polling fallback — ensures orders arrive even if realtime WebSocket drops
  useEffect(() => {
    const interval = setInterval(() => {
      if (shopIdRef.current) fetchPending(shopIdRef.current)
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchPending])

  async function doOrderAction(orderId: string, orderNumber: string, action: 'accept' | 'reject') {
    if (actionLoading) return
    let reason = ''
    if (action === 'reject') {
      reason = prompt('Reason for rejection (optional):') ?? ''
    }

    setActionLoading(orderId)
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch('/api/shopkeeper/order-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ orderId, action, reason })
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          // Already processed — just remove from view
          showToast(`ℹ️ Order ${orderNumber} was already processed`)
          setPendingOrders(prev => prev.filter(o => o.id !== orderId))
        } else {
          showToast(`❌ Error: ${data.error || 'Failed to process order'}`, 'error')
        }
        return
      }

      // Success — remove immediately from local state
      setPendingOrders(prev => {
        const next = prev.filter(o => o.id !== orderId)
        maybeStopAlert(next)
        return next
      })
      // Stop alert for this specific order
      alertingOrdersRef.current.delete(orderId)

      // Show agent assignment feedback on accept
      if (action === 'accept') {
        if (data.agentAssigned) {
          showToast(`✅ Order ${orderNumber} Accepted! Agent ${data.agentName} assigned.`)
        } else {
          showToast(`✅ Order ${orderNumber} Accepted! (No agents available right now)`, 'error')
        }
      } else {
        showToast(`🚫 Order ${orderNumber} Rejected`)
      }

      // Re-verify from DB after 2s to catch any sync issues
      setTimeout(() => {
        if (shopIdRef.current) fetchPending(shopIdRef.current)
      }, 2000)
    } catch {
      showToast('❌ Network error. Please try again.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} />
    </div>
  )


  return (
    <div className="sk-root">
      {/* Mobile Header */}
      <div className="sk-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.3rem' }}>🏪</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'white', lineHeight: 1.1 }}>{shop?.name || 'My Shop'}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: shop?.is_open ? '#4ade80' : '#f87171' }}>
              {shop?.is_open ? '● Open' : '○ Closed'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {pendingOrders.length > 0 && (
            <span style={{ background: '#dc2626', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 10 }}>{pendingOrders.length}</span>
          )}
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Logout</button>
        </div>
      </div>
      {toast && (
        <div className={`sk-toast sk-toast-${toast.type}`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{shop?.name}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className={`badge ${shop?.is_active ? 'badge-green' : 'badge-gray'}`}>{shop?.is_active ? '● Active' : '● Inactive'}</span>
            {shop?.rating && shop.rating > 0 && <span className="badge badge-yellow">⭐ {shop.rating}</span>}
          </div>
        </div>
      </div>

      {/* Setup Nudge Banner — shown when shop profile is incomplete */}
      {shop && !shop.is_profile_complete && (
        <div style={{
          background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
          border: '1.5px solid #fed7aa',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.5rem' }}>🛠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#9a3412' }}>Complete your shop setup</div>
              <div style={{ fontSize: '0.75rem', color: '#c2410c' }}>Add shop name, address, category & more to attract customers</div>
            </div>
          </div>
          <a
            href="/shopkeeper/complete-profile"
            style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Setup Now →
          </a>
        </div>
      )}

      {/* Shop Open/Closed Status Toggle — prominent card */}
      {shop?.is_active && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: shop.is_open ? '#f0fdf4' : '#fef2f2',
          border: `1.5px solid ${shop.is_open ? '#86efac' : '#fca5a5'}`,
          borderRadius: 12, padding: '14px 18px', marginBottom: 20, gap: 12, flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.8rem' }}>{shop.is_open ? '🟢' : '🔴'}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: shop.is_open ? '#15803d' : '#dc2626' }}>
                Shop is Currently {shop.is_open ? 'OPEN' : 'CLOSED'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                {shop.is_open
                  ? 'Customers can see and order from your shop.'
                  : 'Your shop is hidden from customers. Toggle to go online.'}
              </div>
            </div>
          </div>
          <button
            disabled={togglingOpen}
            onClick={async () => {
              if (!shop) return
              const next = !shop.is_open
              const confirmed = window.confirm(
                next
                  ? 'Open your shop? Customers will be able to see and order from you.'
                  : 'Close your shop? Customers will NOT be able to see or order from you until you reopen.'
              )
              if (!confirmed) return
              setTogglingOpen(true)
              const { error } = await supabase.from('shops').update({ is_open: next }).eq('id', shop.id)
              if (error) {
                showToast('❌ Failed to update shop status.', 'error')
              } else {
                setShop(s => s ? { ...s, is_open: next } : s)
                showToast(next ? '🟢 Shop is now OPEN!' : '🔴 Shop is now CLOSED.', next ? 'success' : 'error')
              }
              setTogglingOpen(false)
            }}
            style={{
              background: shop.is_open ? '#dc2626' : '#16a34a',
              color: 'white', border: 'none', borderRadius: 10,
              padding: '10px 20px', fontWeight: 800, fontSize: '0.9rem',
              cursor: togglingOpen ? 'not-allowed' : 'pointer',
              opacity: togglingOpen ? 0.6 : 1, whiteSpace: 'nowrap'
            }}
          >
            {togglingOpen ? '⏳ Updating...' : shop.is_open ? '🔴 Close Shop' : '🟢 Open Shop'}
          </button>
        </div>
      )}

      {/* Subscription Status Banner */}
      {(() => {
        const expiresAt = shop?.subscription_expires_at
        if (!expiresAt) {
          // No plan or percentage plan — show warning if not active
          if (!shop?.is_active) {
            return (
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 2 }}>🔴 Shop Inactive — No Active Plan</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Purchase a subscription plan to make your shop visible to customers.</div>
                </div>
                <a href="/shopkeeper/plans" className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>View Plans →</a>
              </div>
            )
          }
          return null
        }
        const expiry = new Date(expiresAt)
        const daysLeft = nowTime && nowTime > 0 ? Math.ceil((expiry.getTime() - nowTime) / 86400000) : 0
        if (daysLeft <= 0) {
          return (
            <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 2 }}>⚠️ Subscription Expired</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Your shop is now hidden from customers. Renew to reactivate.</div>
              </div>
              <a href="/shopkeeper/plans" className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>🔄 Renew Plan →</a>
            </div>
          )
        }
        if (daysLeft <= 5) {
          return (
            <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#d97706', marginBottom: 2 }}>⏰ Plan Expiring Soon — {daysLeft} day{daysLeft !== 1 ? 's' : ''} left</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Expires on {expiry.toLocaleDateString('en-IN')}. Renew now to avoid interruption.</div>
              </div>
              <a href="/shopkeeper/plans" className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>Renew Now →</a>
            </div>
          )
        }
        return (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.85rem' }}>✅ Plan active — {daysLeft} days remaining (expires {expiry.toLocaleDateString('en-IN')})</span>
            <a href="/shopkeeper/plans" style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#16a34a', fontWeight: 700 }}>Manage →</a>
          </div>
        )
      })()}

      {/* Stats Row */}
      <div className="sk-stats-row">
        {[
          { icon: '💰', label: 'Today Earnings', value: `₹${todayEarnings.toFixed(0)}`, color: '#22c55e', bg: '#f0fdf4' },
          { icon: '🏦', label: 'Wallet', value: `₹${(shop?.wallet_balance || 0).toFixed(0)}`, color: '#f97316', bg: '#fff7ed' },
          { icon: '📦', label: 'Total Orders', value: shop?.total_orders || 0, color: '#0ea5e9', bg: '#f0f9ff' },
          { icon: '💼', label: 'Total Earned', value: `₹${(shop?.total_earnings || 0).toFixed(0)}`, color: '#a855f7', bg: '#faf5ff' },
        ].map(s => (
          <div key={s.label} className="sk-stat-card" style={{ background: s.bg }}>
            <div style={{ fontSize: '1.1rem', marginBottom: 2 }}>{s.icon}</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Orders Dashboard */}
      {(() => {
        const incoming = pendingOrders.filter(o => o.status === 'payment_confirmed')
        const active = pendingOrders.filter(o => ['shop_accepted','order_packed','agent_assigned','picked_up','out_for_delivery'].includes(o.status))
        const history = pendingOrders.filter(o => ['delivered','rejected','cancelled'].includes(o.status))

        function renderOrder(order: Order, idx: number) {
          const badge = STATUS_BADGE[order.status] || STATUS_BADGE.payment_confirmed
          const itemCount = order.items?.length || 0
          const isProcessing = actionLoading === order.id
          const isNew = order.status === 'payment_confirmed' && (alertingOrderIds.has(order.id) || idx === 0 && alertingOrderIds.size > 0)
          return (
            <div key={order.id} style={{ background: 'white', borderRadius: 12, border: `1.5px solid ${badge.border}`, overflow: 'hidden', marginBottom: 10 }}>
              {isNew && <div style={{ background: '#f97316', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '5px 12px' }}>🔔 NEW ORDER</div>}
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{order.order_number}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 1 }}>{new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ background: badge.bg, color: badge.color, fontSize: '0.65rem', fontWeight: 800, padding: '3px 9px', borderRadius: 99, border: `1px solid ${badge.border}` }}>
                      {badge.icon} {badge.label}
                    </span>
                    <span style={{ fontWeight: 800, color: '#f97316', fontSize: '1rem' }}>₹{order.shopkeeper_earning || order.subtotal || order.total_amount}</span>
                  </div>
                </div>

                {order.agent_name && (
                  <div style={{ background: '#f0f9ff', borderRadius: 7, padding: '5px 10px', fontSize: '0.75rem', color: '#0369a1', marginBottom: 8, fontWeight: 600 }}>
                    🛵 Agent: {order.agent_name}
                  </div>
                )}
                {order.rejection_reason && order.status === 'rejected' && (
                  <div style={{ background: '#fef2f2', borderRadius: 7, padding: '5px 10px', fontSize: '0.75rem', color: '#dc2626', marginBottom: 8 }}>
                    ❌ Rejected: {order.rejection_reason}
                  </div>
                )}

                {itemCount > 0 && (
                  <div style={{ border: '1px solid #f1f5f9', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                    {order.items.slice(0, 3).map((item, i) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: i % 2 === 0 ? '#f8fafc' : 'white', borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                        {item.product_image_url
                          ? <img src={item.product_image_url} alt={item.product_name} style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                          : <div style={{ width: 30, height: 30, background: '#e2e8f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>🛍️</div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>₹{item.unit_price} × {item.quantity}</div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#f97316' }}>₹{item.total_price}</div>
                      </div>
                    ))}
                    {itemCount > 3 && (
                      <div style={{ padding: '6px 10px', background: '#f8fafc', fontSize: '0.7rem', color: '#64748b', borderTop: '1px solid #f1f5f9' }}>+{itemCount - 3} more items</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#fff7ed', borderTop: '1px solid #f1f5f9' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Your Earnings</span>
                      <span style={{ fontWeight: 800, color: '#f97316', fontSize: '0.8rem' }}>₹{order.shopkeeper_earning || order.subtotal || order.total_amount}</span>
                    </div>
                  </div>
                )}

                {/* Action buttons — only for incoming orders */}
                {order.status === 'payment_confirmed' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => doOrderAction(order.id, order.order_number, 'accept')} disabled={isProcessing}
                      style={{ flex: 1, background: isProcessing ? '#dcfce7' : '#16a34a', color: isProcessing ? '#16a34a' : 'white', border: 'none', borderRadius: 9, padding: '11px', fontWeight: 800, fontSize: '0.82rem', cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
                      {isProcessing ? '⏳...' : '✓ Accept'}
                    </button>
                    <button onClick={() => doOrderAction(order.id, order.order_number, 'reject')} disabled={isProcessing}
                      style={{ background: isProcessing ? '#fee2e2' : '#dc2626', color: isProcessing ? '#dc2626' : 'white', border: 'none', borderRadius: 9, padding: '11px 16px', fontWeight: 700, fontSize: '0.82rem', cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        }

        return (
          <div>
            {/* Section: Incoming — needs action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                🔔 Incoming{incoming.length > 0 && <span style={{ background: '#f97316', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10, marginLeft: 6 }}>{incoming.length}</span>}
              </h3>
              <button onClick={() => shopIdRef.current && fetchPending(shopIdRef.current)}
                style={{ border: 'none', cursor: 'pointer', color: '#f97316', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(249,115,22,0.1)', padding: '5px 10px', borderRadius: 7 }}>🔄 Refresh</button>
            </div>
            {incoming.length === 0
              ? <div style={{ textAlign: 'center', padding: '24px 16px', background: '#f8fafc', borderRadius: 12, marginBottom: 16 }}><div style={{ fontSize: '2rem', marginBottom: 6 }}>✅</div><p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>No new orders</p></div>
              : incoming.map((o, i) => renderOrder(o, i))}

            {/* Section: Active orders */}
            {active.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.3px' }}>📋 Active Orders ({active.length})</h3>
                {active.map((o, i) => renderOrder(o, i))}
              </div>
            )}

            {/* Section: History */}
            {history.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.3px' }}>📅 Today's History</h3>
                {history.map((o, i) => renderOrder(o, i))}
              </div>
            )}
          </div>
        )
      })()}

      <style>{`
        .sk-root { min-height: 100%; }
        .sk-mobile-header { display: none; }
        .sk-stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; padding: 0 16px; margin-bottom: 24px; }
        .sk-stat-card { background: white; border: 1.5px solid var(--border); border-radius: 14px; padding: 14px 12px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
        .sk-stat-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
        .sk-stat-value { font-size: 1.2rem; font-weight: 800; color: #0f172a; line-height: 1; }
        .sk-stat-label { font-size: 0.7rem; color: #64748b; font-weight: 600; }
        .sk-toast { position: fixed; z-index: 9999; top: calc(16px + env(safe-area-inset-top,0px)); left: 12px; right: 12px; border-radius: 10px; padding: 12px 18px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); font-weight: 600; font-size: 0.9rem; text-align: center; animation: fadeIn 0.2s ease; max-width: 400px; margin: 0 auto; }
        .sk-toast-success { background: white; border: 1.5px solid #22c55e; color: #15803d; }
        .sk-stats-row { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 16px; }
        .sk-stats-row::-webkit-scrollbar { display: none; }
        .sk-stat-card { min-width: 80px; flex: 1; border-radius: 12px; padding: 12px 10px; text-align: center; border: 1px solid; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .sk-toast { position: fixed; z-index: 9999; top: calc(16px + env(safe-area-inset-top,0px)); left: 12px; right: 12px; border-radius: 10px; padding: 12px 18px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); font-weight: 600; font-size: 0.9rem; text-align: center; animation: fadeIn 0.2s ease; max-width: 400px; margin: 0 auto; }
        .sk-toast-success { background: #f0fdf4; border: 1.5px solid #86efac; color: #16a34a; }
        .sk-toast-error { background: #fef2f2; border: 1.5px solid #fca5a5; color: #dc2626; }
        @media (max-width: 768px) {
          .sk-mobile-header { display: flex !important; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 12px 16px; padding-top: calc(12px + env(safe-area-inset-top,0px)); position: sticky; top: 0; z-index: 30; }
          .sk-stats-row { padding: 0 12px; }
          .sk-stat-card { min-width: 70px; }
        }
      `}</style>
    </div>
  )
}
