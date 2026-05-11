'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Shop { id: string; name: string; is_approved: boolean; is_active: boolean; wallet_balance: number; total_earnings: number; total_orders: number; rating: number; subscription_expires_at?: string | null; subscription_fee_percent?: number }
interface OrderItem { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_image_url: string }
interface Order { id: string; order_number: string; status: string; total_amount: number; created_at: string; items: OrderItem[] }

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
  const shopIdRef = useRef<string | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function playAlert() {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880; gain.gain.value = 0.3
      osc.start(); osc.stop(ctx.currentTime + 0.4)
    } catch {}
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
      }, async () => {
        if (!mounted || !shopIdRef.current) return
        await fetchPending(shopIdRef.current)
        playAlert()
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
      setPendingOrders(prev => prev.filter(o => o.id !== orderId))
      showToast(action === 'accept' ? `✅ Order ${orderNumber} Accepted!` : `🚫 Order ${orderNumber} Rejected`)

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
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>⏳</div>
      <h2 style={{ marginBottom: 8 }}>Awaiting Admin Approval</h2>
      <p>Your shop <strong>{shop.name}</strong> is under review.</p>
    </div>
  )

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? '#fef2f2' : 'white',
          border: `1.5px solid ${toast.type === 'error' ? '#dc2626' : 'var(--border)'}`,
          borderRadius: 10, padding: '12px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          fontWeight: 600, fontSize: '0.92rem', maxWidth: 300,
          animation: 'slideIn 0.25s ease',
        }}>
          {toast.msg}
        </div>
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
        <button className="btn btn-outline btn-sm" onClick={async () => {
          if (!shop) return
          await supabase.from('shops').update({ is_open: !shop.is_active }).eq('id', shop.id)
          setShop(s => s ? { ...s, is_active: !s.is_active } : s)
        }}>🔄 Toggle Open/Close</button>
      </div>

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
        const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86400000)
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
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {[
          { icon: '💰', label: "Today's Earnings", value: `₹${todayEarnings.toFixed(0)}`, color: '#22c55e' },
          { icon: '🏦', label: 'Wallet Balance', value: `₹${(shop?.wallet_balance || 0).toFixed(0)}`, color: '#f97316' },
          { icon: '📦', label: 'Total Orders', value: shop?.total_orders || 0, color: '#0ea5e9' },
          { icon: '💼', label: 'Total Earned', value: `₹${(shop?.total_earnings || 0).toFixed(0)}`, color: '#a855f7' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: `${s.color}20` }}><span>{s.icon}</span></div>
            <div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
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
          {pendingOrders.map(order => {
            const isExpanded = expanded.has(order.id)
            const itemCount = order.items?.length || 0
            const isProcessing = actionLoading === order.id

            return (
              <div key={order.id} className="card" style={{ padding: 0, overflow: 'hidden', border: '1.5px solid var(--border)', borderLeft: '4px solid #f59e0b' }}>
                
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
                      <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.2rem' }}>₹{order.total_amount}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{itemCount} item{itemCount !== 1 ? 's' : ''}</div>
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
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>Total</span>
                        <span style={{ fontWeight: 800, color: 'var(--primary)' }}>₹{order.total_amount}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => doOrderAction(order.id, order.order_number, 'accept')}
                    disabled={isProcessing}
                    style={{
                      flex: 1, padding: '14px', border: 'none',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      background: isProcessing ? '#d1fae5' : '#16a34a',
                      color: isProcessing ? '#16a34a' : 'white',
                      fontWeight: 700, fontSize: '0.9rem',
                      transition: 'all 0.15s',
                    }}
                  >
                    {isProcessing ? '⏳ Processing...' : '✅ Accept Order'}
                  </button>
                  <button
                    onClick={() => doOrderAction(order.id, order.order_number, 'reject')}
                    disabled={isProcessing}
                    style={{
                      flex: 1, padding: '14px', border: 'none',
                      borderLeft: '1px solid rgba(255,255,255,0.3)',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      background: isProcessing ? '#fee2e2' : '#dc2626',
                      color: isProcessing ? '#dc2626' : 'white',
                      fontWeight: 700, fontSize: '0.9rem',
                    }}
                  >
                    ❌ Reject
                  </button>
                  <a href={`/shopkeeper/orders/${order.id}`}
                    style={{
                      padding: '14px 18px', borderLeft: '1px solid var(--border)',
                      background: 'var(--bg3)', color: 'var(--text)',
                      fontWeight: 600, fontSize: '0.88rem',
                      textDecoration: 'none', display: 'flex', alignItems: 'center',
                      whiteSpace: 'nowrap', flexShrink: 0
                    }}
                  >
                    Details →
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
