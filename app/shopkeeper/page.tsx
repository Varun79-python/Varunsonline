'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Shop { id: string; name: string; is_approved: boolean; is_active: boolean; wallet_balance: number; total_earnings: number; total_orders: number; rating: number }
interface OrderItem { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_image_url: string }
interface Order { id: string; order_number: string; status: string; total_amount: number; created_at: string; order_items: OrderItem[] }

export default function ShopkeeperDashboard() {
  const supabase = createClient()
  const [shop, setShop] = useState<Shop | null>(null)
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [todayEarnings, setTodayEarnings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [noShop, setNoShop] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const shopIdRef = useRef<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function playAlert() {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880; gain.gain.value = 0.3
      osc.start(); osc.stop(ctx.currentTime + 0.3)
    } catch {}
  }

  // ── Fetch ONLY truly pending orders (payment_confirmed) + their items ──
  const fetchPending = useCallback(async (shopId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, status, total_amount, created_at, order_items(id, product_name, quantity, unit_price, total_price, product_image_url)')
      .eq('shop_id', shopId)
      .eq('status', 'payment_confirmed')   // ONLY pending
      .order('created_at', { ascending: false })

    if (!error && data) {
      // Double-check: filter client-side too in case of race condition
      const truly_pending = data.filter((o: Order) => o.status === 'payment_confirmed')
      setPendingOrders(truly_pending)
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

      const today = new Date().toISOString().split('T')[0]
      const { data: todayOrders } = await supabase
        .from('orders').select('shopkeeper_earning')
        .eq('shop_id', shopData.id).eq('payment_status', 'paid').gte('created_at', today)

      setTodayEarnings(todayOrders?.reduce((s: number, o: { shopkeeper_earning: number }) => s + o.shopkeeper_earning, 0) || 0)
      await fetchPending(shopData.id)
      if (!mounted) return
      setLoading(false)

      // Realtime: new orders arriving
      channel = supabase.channel(`shop-orders-${shopData.id}`)
      channel.on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'orders',
        filter: `shop_id=eq.${shopData.id}`
      }, async (payload) => {
        if (!mounted) return
        // Fetch the full order with items
        const { data: newOrder } = await supabase
          .from('orders')
          .select('id, order_number, status, total_amount, created_at, order_items(id, product_name, quantity, unit_price, total_price, product_image_url)')
          .eq('id', (payload.new as Order).id)
          .single()
        if (newOrder && newOrder.status === 'payment_confirmed') {
          setPendingOrders(prev => [newOrder, ...prev])
          playAlert()
          showToast(`🔔 New Order ${newOrder.order_number} received!`)
        }
      }).subscribe()
    }

    loadData()
    return () => { mounted = false; if (channel) { supabase.removeChannel(channel); channel = null } }
  }, [fetchPending])

  async function acceptOrder(orderId: string, orderNumber: string) {
    if (actionLoading) return
    setActionLoading(orderId)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'shop_accepted', accepted_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('status', 'payment_confirmed') // guard: only update if still pending

      if (error) {
        console.error('Accept error:', error)
        showToast('❌ Failed to accept. Check your permissions.')
        return
      }

      // Insert status history (best effort, don't block on failure)
      supabase.from('order_status_history')
        .insert({ order_id: orderId, status: 'shop_accepted' })
        .then(() => {})

      // Remove from local state immediately
      setPendingOrders(prev => prev.filter(o => o.id !== orderId))
      showToast(`✅ Order ${orderNumber} Accepted!`)

      // Re-fetch from DB after 1.5s to confirm sync (in case of network delay)
      if (shopIdRef.current) {
        setTimeout(() => fetchPending(shopIdRef.current!), 1500)
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function rejectOrder(orderId: string, orderNumber: string) {
    if (actionLoading) return
    const reason = prompt('Reason for rejection (optional):') || ''
    setActionLoading(orderId)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'rejected', rejection_reason: reason })
        .eq('id', orderId)
        .eq('status', 'payment_confirmed')

      if (error) {
        showToast('❌ Failed to reject. Please try again.')
        return
      }

      supabase.from('order_status_history')
        .insert({ order_id: orderId, status: 'rejected' })
        .then(() => {})

      setPendingOrders(prev => prev.filter(o => o.id !== orderId))
      showToast(`🚫 Order ${orderNumber} Rejected`)

      if (shopIdRef.current) {
        setTimeout(() => fetchPending(shopIdRef.current!), 1500)
      }
    } finally {
      setActionLoading(null)
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} /></div>

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
      <p>Your shop <strong>{shop.name}</strong> is under review. You&apos;ll be notified once approved.</p>
    </div>
  )

  return (
    <div className="fade-in">
      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: 'white', border: '1.5px solid var(--border)',
          borderRadius: 10, padding: '12px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          fontWeight: 600, fontSize: '0.92rem',
          animation: 'slideIn 0.25s ease',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{shop?.name}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className={`badge ${shop?.is_active ? 'badge-green' : 'badge-gray'}`}>{shop?.is_active ? '● Active' : '● Inactive'}</span>
            {shop?.rating && shop.rating > 0 && <span className="badge badge-yellow">⭐ {shop.rating}</span>}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={async () => {
          if (!shop) return
          const { error } = await supabase.from('shops').update({ is_open: !shop.is_active }).eq('id', shop.id)
          if (!error) setShop(s => s ? { ...s, is_active: !s.is_active } : s)
        }}>
          🔄 Toggle Open/Close
        </button>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {[
          { icon: '💰', label: "Today's Earnings", value: `₹${todayEarnings.toFixed(0)}`, color: '#22c55e' },
          { icon: '🏦', label: 'Wallet Balance', value: `₹${shop?.wallet_balance?.toFixed(0) || 0}`, color: '#f97316' },
          { icon: '📦', label: 'Total Orders', value: shop?.total_orders || 0, color: '#0ea5e9' },
          { icon: '💼', label: 'Total Earned', value: `₹${shop?.total_earnings?.toFixed(0) || 0}`, color: '#a855f7' },
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
        <button
          onClick={() => shopIdRef.current && fetchPending(shopIdRef.current)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem' }}
        >
          🔄 Refresh
        </button>
      </div>

      {pendingOrders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
          <p>No pending orders. All caught up!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingOrders.map(order => {
            const isExpanded = expanded.has(order.id)
            const itemCount = order.order_items?.length || 0
            const isProcessing = actionLoading === order.id

            return (
              <div key={order.id} className="card" style={{ borderLeft: '4px solid var(--warning)', padding: 0, overflow: 'hidden' }}>
                {/* Order header */}
                <div style={{ padding: '14px 16px' }}>
                  <div className="flex-between" style={{ marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{order.order_number}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(order.created_at).toLocaleTimeString('en-IN')}
                        {' · '}
                        <button
                          onClick={() => toggleExpand(order.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem', padding: 0 }}
                        >
                          {itemCount} item{itemCount !== 1 ? 's' : ''} {isExpanded ? '▲' : '▼'}
                        </button>
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem' }}>₹{order.total_amount}</span>
                  </div>

                  {/* Quick item preview (always visible) */}
                  {order.order_items?.slice(0, isExpanded ? 999 : 2).map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                      <span>• {item.product_name} <strong style={{ color: 'var(--text)' }}>×{item.quantity}</strong></span>
                      <span style={{ color: 'var(--text)' }}>₹{item.total_price}</span>
                    </div>
                  ))}
                  {!isExpanded && itemCount > 2 && (
                    <button onClick={() => toggleExpand(order.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.78rem', padding: '2px 0', fontWeight: 600 }}>
                      + {itemCount - 2} more item{itemCount - 2 !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => acceptOrder(order.id, order.order_number)}
                    disabled={isProcessing}
                    style={{
                      flex: 1, padding: '12px', border: 'none', cursor: isProcessing ? 'not-allowed' : 'pointer',
                      background: isProcessing ? 'var(--bg3)' : '#16a34a', color: 'white',
                      fontWeight: 700, fontSize: '0.88rem', transition: 'background 0.15s',
                      opacity: isProcessing ? 0.7 : 1
                    }}
                  >
                    {isProcessing ? '⏳ Processing...' : '✅ Accept'}
                  </button>
                  <button
                    onClick={() => rejectOrder(order.id, order.order_number)}
                    disabled={isProcessing}
                    style={{
                      flex: 1, padding: '12px', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.2)',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      background: isProcessing ? 'var(--bg3)' : '#dc2626', color: 'white',
                      fontWeight: 700, fontSize: '0.88rem', transition: 'background 0.15s',
                      opacity: isProcessing ? 0.7 : 1
                    }}
                  >
                    ❌ Reject
                  </button>
                  <a
                    href={`/shopkeeper/orders/${order.id}`}
                    style={{
                      padding: '12px 18px', border: 'none', borderLeft: '1px solid var(--border)',
                      background: 'var(--bg3)', color: 'var(--text)', fontWeight: 600, fontSize: '0.88rem',
                      textDecoration: 'none', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap'
                    }}
                  >
                    View →
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
