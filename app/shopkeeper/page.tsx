'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrderAlert } from '@/lib/useOrderAlert'

interface Shop { id: string; name: string; is_approved: boolean; is_active: boolean; is_open: boolean; wallet_balance: number; total_earnings: number; total_orders: number; rating: number; subscription_expires_at?: string | null; subscription_fee_percent?: number; rejection_reason?: string | null }
interface OrderItem { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_image_url: string }
interface Order { id: string; order_number: string; status: string; total_amount: number; shopkeeper_earning: number; subtotal: number; created_at: string; items: OrderItem[] }

export default function ShopkeeperDashboard() {
  const supabase = createClient()
  const [shop, setShop] = useState<Shop | null>(null)
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [todayEarnings, setTodayEarnings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [noShop, setNoShop] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [togglingOpen, setTogglingOpen] = useState(false)
  const shopIdRef = useRef<string | null>(null)
  // Track which order IDs are currently alerting (to stop when handled)
  const alertingOrdersRef = useRef<Set<string>>(new Set())
  const { start: startAlert, stop: stopAlert } = useOrderAlert()

  const [nowTime, setNowTime] = useState<number>(0)
  useEffect(() => { setNowTime(Date.now()) }, [])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
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
      const res = await fetch(`/api/shopkeeper/pending-orders?shopId=${shopId}`)
      const data = await res.json()
      if (res.ok && data.orders) {
        setPendingOrders(data.orders)
      } else {
        setPendingOrders([])
      }
    } catch {
      setPendingOrders([])
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) return

      const { data: shopData } = await supabase.from('shops').select('*').eq('owner_id', user.id).single()
      if (!mounted) return
      if (!shopData) { setNoShop(true); setLoading(false); return }
      setShop(shopData)
      shopIdRef.current = shopData.id

      // ── Subscription Expiry Check ──────────────────────────────
      // Check if fixed_monthly plan has expired; if so, deactivate shop instantly
      if (shopData.subscription_expires_at) {
        const expiry = new Date(shopData.subscription_expires_at)
        if (expiry < new Date() && shopData.is_active) {
          // Deactivate the shop
          await supabase.from('shops').update({ is_active: false, subscription_plan_id: null, subscription_fee_percent: 0 }).eq('id', shopData.id)
          // Mark the subscription as inactive
          await supabase.from('shop_subscriptions').update({ is_active: false })
            .eq('shop_id', shopData.id).eq('is_active', true)
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
      }, async (payload) => {
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

  async function doOrderAction(orderId: string, orderNumber: string, action: 'accept' | 'reject') {
    if (actionLoading) return
    let reason = ''
    if (action === 'reject') {
      reason = prompt('Reason for rejection (optional):') ?? ''
    }

    setActionLoading(orderId)
    try {
      const res = await fetch('/api/shopkeeper/order-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  if (noShop) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>🏪</div>
      <h2 style={{ marginBottom: 8 }}>No Shop Registered</h2>
      <p style={{ marginBottom: 24 }}>Register your shop to start selling online</p>
      <a className="btn btn-primary" href="/shopkeeper/register">Register Shop →</a>
    </div>
  )

  if (shop && !shop.is_approved) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>
        {shop.rejection_reason ? '❌' : '⏳'}
      </div>
      <h2 style={{ marginBottom: 8 }}>
        {shop.rejection_reason ? 'Registration Rejected' : 'Awaiting Admin Approval'}
      </h2>
      <p>Your shop <strong>{shop.name}</strong> {shop.rejection_reason ? 'was rejected.' : 'is under review.'}</p>
      {shop.rejection_reason && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, margin: '20px auto', maxWidth: 400, textAlign: 'left' }}>
          <div style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 600, marginBottom: 6 }}>Reason:</div>
          <div style={{ color: '#7f1d1d', fontSize: '0.9rem' }}>{shop.rejection_reason}</div>
        </div>
      )}
      <p style={{ marginTop: 20, color: '#64748b', fontSize: '0.85rem' }}>
        Contact support if you have questions.
      </p>
    </div>
  )

  return (
    <div className="sk-root">
      {/* Mobile-only sticky header */}
      <div className="sk-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.3rem' }}>🏪</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', lineHeight: 1.1 }}>{shop?.name || 'My Shop'}</div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: shop?.is_open ? '#16a34a' : '#dc2626' }}>
              {shop?.is_open ? '🟢 Open' : '🔴 Closed'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pendingOrders.length > 0 && (
            <span className="sk-badge-alert">{pendingOrders.length} new</span>
          )}
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }} className="sk-logout-btn">Logout</button>
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
        const daysLeft = nowTime > 0 ? Math.ceil((expiry.getTime() - nowTime) / 86400000) : 0
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

      {/* Stats */}
      <div className="sk-stats-grid">
        {[
          { icon: '💰', label: "Today's Earnings", value: `₹${todayEarnings.toFixed(0)}`, color: '#22c55e' },
          { icon: '🏦', label: 'Wallet Balance', value: `₹${(shop?.wallet_balance || 0).toFixed(0)}`, color: '#f97316' },
          { icon: '📦', label: 'Total Orders', value: shop?.total_orders || 0, color: '#0ea5e9' },
          { icon: '💼', label: 'Total Earned', value: `₹${(shop?.total_earnings || 0).toFixed(0)}`, color: '#a855f7' },
        ].map(s => (
          <div key={s.label} className="sk-stat-card">
            <div className="sk-stat-icon" style={{ background: `${s.color}20`, color: s.color }}>{s.icon}</div>
            <div className="sk-stat-value">{s.value}</div>
            <div className="sk-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending Orders */}
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <h3>
          🔔 Incoming Orders{' '}
          {pendingOrders.length > 0 && (
            <span className="badge badge-orange" style={{ marginLeft: 8 }}>{pendingOrders.length}</span>
          )}
        </h3>
        <button onClick={() => shopIdRef.current && fetchPending(shopIdRef.current)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 600 }}>
          🔄 Refresh
        </button>
      </div>

      {pendingOrders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
          <p>No pending orders. All caught up!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pendingOrders.map((order, idx) => {
            const isExpanded = expanded.has(order.id)
            const itemCount = order.items?.length || 0
            const isProcessing = actionLoading === order.id
            // Cards added while alert is active get the pulse treatment
            const isNew = alertingOrdersRef.current.has(order.id) || idx === 0 && alertingOrdersRef.current.size > 0

            return (
              <div key={order.id} className={`card sk-order-card${isNew ? ' sk-order-new' : ''}`} style={{ padding: 0, overflow: 'hidden', borderLeft: '4px solid #f59e0b' }}>

                {isNew && (
                  <div className="sk-new-badge">🔔 New Order</div>
                )}

                {/* Order header */}
                <div style={{ padding: '16px 16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{order.order_number}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {new Date(order.created_at).toLocaleTimeString('en-IN')}
                      </div>
                    </div>
                  <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.2rem' }}>₹{order.shopkeeper_earning || order.subtotal || order.total_amount}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{itemCount} item{itemCount !== 1 ? 's' : ''} · Your Earning</div>
                    </div>
                  </div>
                </div>

                {/* Product list — always visible */}
                <div style={{ padding: '0 16px 14px' }}>
                  {itemCount === 0 ? (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '8px 0' }}>
                      Loading items...
                    </div>
                  ) : (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
                      {order.items.map((item, idx) => (
                        <div key={item.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          background: idx % 2 === 0 ? 'var(--bg)' : 'white',
                          borderTop: idx > 0 ? '1px solid var(--border)' : 'none'
                        }}>
                          {item.product_image_url ? (
                            <img src={item.product_image_url} alt={item.product_name}
                              style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 40, height: 40, background: 'var(--bg3)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>🛍️</div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.product_name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              ₹{item.unit_price} × {item.quantity}
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)', flexShrink: 0 }}>
                            ₹{item.total_price}
                          </div>
                        </div>
                      ))}
                      {/* Total row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#fff7ed', borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>Your Earnings</span>
                        <span style={{ fontWeight: 800, color: 'var(--primary)' }}>₹{order.shopkeeper_earning || order.subtotal || order.total_amount}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="sk-order-actions">
                  <button
                    onClick={() => doOrderAction(order.id, order.order_number, 'accept')}
                    disabled={isProcessing}
                    className="sk-accept-btn"
                    style={{ background: isProcessing ? '#d1fae5' : '#16a34a', color: isProcessing ? '#16a34a' : 'white' }}
                  >
                    {isProcessing ? '⏳ Processing...' : '✅ Accept Order'}
                  </button>
                  <button
                    onClick={() => doOrderAction(order.id, order.order_number, 'reject')}
                    disabled={isProcessing}
                    className="sk-reject-btn"
                    style={{ background: isProcessing ? '#fee2e2' : '#dc2626', color: isProcessing ? '#dc2626' : 'white' }}
                  >
                    ❌ Reject
                  </button>
                  <a href={`/shopkeeper/orders/${order.id}`} className="sk-details-btn">Details ›</a>
                </div>
              </div>
            )
          })}
        </div>
      )}

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
        .sk-toast-error   { background: #fef2f2; border: 1.5px solid #dc2626; color: #dc2626; }
        .sk-order-actions { display: flex; border-top: 1px solid var(--border); }
        .sk-accept-btn { flex: 1; min-height: 52px; border: none; font-weight: 700; font-size: 0.9rem; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: background 0.1s; }
        .sk-accept-btn:active { filter: brightness(0.9); }
        .sk-accept-btn:disabled { cursor: not-allowed; }
        .sk-reject-btn { flex: 1; min-height: 52px; border: none; border-left: 1px solid rgba(255,255,255,0.25); font-weight: 700; font-size: 0.9rem; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .sk-reject-btn:active { filter: brightness(0.9); }
        .sk-reject-btn:disabled { cursor: not-allowed; }
        .sk-details-btn { padding: 0 16px; border-left: 1px solid var(--border); background: var(--bg3); color: var(--text); font-weight: 600; font-size: 0.85rem; text-decoration: none; display: flex; align-items: center; white-space: nowrap; flex-shrink: 0; min-height: 52px; }
        /* ── New order pulse effect ── */
        @keyframes sk-pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); border-color: #f59e0b; }
          50%       { box-shadow: 0 0 0 8px rgba(245,158,11,0); border-color: #f97316; }
        }
        .sk-order-card { border: 1.5px solid var(--border); }
        .sk-order-new  { animation: sk-pulse-glow 1.4s ease infinite; border-color: #f59e0b !important; }
        .sk-new-badge  {
          background: linear-gradient(90deg, #f59e0b, #f97316);
          color: white; font-size: 0.72rem; font-weight: 800;
          padding: 5px 14px; letter-spacing: 0.3px;
          display: flex; align-items: center; gap: 5px;
        }
        @media (max-width: 768px) {
          .sk-mobile-header { display: flex !important; align-items: center; justify-content: space-between; background: white; border-bottom: 1.5px solid #f1f5f9; padding: 12px 16px; padding-top: calc(12px + env(safe-area-inset-top,0px)); position: sticky; top: 0; z-index: 30; box-shadow: 0 1px 8px rgba(0,0,0,0.06); }
          .sk-logout-btn { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 99px; padding: 6px 12px; font-size: 0.72rem; font-weight: 700; cursor: pointer; touch-action: manipulation; }
          .sk-badge-alert { background: #f97316; color: white; font-size: 0.65rem; font-weight: 800; padding: 3px 8px; border-radius: 99px; }
          .sk-stats-grid { grid-template-columns: repeat(2,1fr); gap: 10px; padding: 12px 12px 0; margin-bottom: 16px; }
          .sk-stat-card { padding: 12px 10px; border-radius: 12px; }
          .sk-stat-value { font-size: 1.1rem; }
          .sk-stat-label { font-size: 0.65rem; }
          .sk-stat-icon  { width: 32px; height: 32px; font-size: 1rem; }
        }
      `}</style>
    </div>
  )
}
