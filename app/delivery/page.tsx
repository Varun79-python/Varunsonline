'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Shop { name: string; address_line1: string; city: string; latitude: number; longitude: number }
interface Address { house_name: string; street_name: string; landmark: string; city: string; latitude: number; longitude: number }
interface Order {
  id: string; order_number: string; status: string; agent_earning: number
  total_amount: number; created_at: string; delivery_charge: number
  shops: Shop; addresses: Address
}
interface Agent { id: string; is_approved: boolean; is_available: boolean; wallet_balance: number; today_earnings: number; total_deliveries: number }

export default function DeliveryDashboard() {
  const supabase = createClient()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [availOrders, setAvailOrders] = useState<Order[]>([])
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [noProfile, setNoProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500) }

  // Fetch available orders via server API (bypasses RLS)
  const fetchAvailable = useCallback(async () => {
    const res = await fetch('/api/delivery/orders')
    const data = await res.json()
    setAvailOrders(data.orders || [])
  }, [])

  // Fetch this agent's active order (already assigned to them — agent CAN read this)
  const fetchActive = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('orders')
      .select('*, shops:shop_id(*), addresses:address_id(*)')
      .eq('agent_id', uid)
      .in('status', ['agent_assigned', 'picked_up', 'out_for_delivery'])
      .maybeSingle()
    return data as Order | null
  }, [supabase])

  useEffect(() => {
    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) return

      const { data: ag } = await supabase.from('delivery_agents').select('*').eq('id', user.id).single()
      if (!mounted) return
      if (!ag) { setNoProfile(true); setLoading(false); return }
      setAgent(ag)
      setAgentId(user.id)
      if (!ag.is_approved) { setLoading(false); return }

      const active = await fetchActive(user.id)
      if (!mounted) return
      setActiveOrder(active)

      if (!active) {
        await fetchAvailable()
      }
      setLoading(false)

      // Realtime: listen for order status changes — refresh when any order updates
      channel = supabase.channel(`delivery-live-${user.id}`)
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, async () => {
        if (!mounted) return
        const act = await fetchActive(user.id)
        setActiveOrder(act)
        if (!act) await fetchAvailable()
        else setAvailOrders([]) // hide available if now we have active
      }).subscribe()
    }

    loadData()
    return () => { mounted = false; if (channel) { supabase.removeChannel(channel); channel = null } }
  }, [fetchAvailable, fetchActive, supabase])

  async function acceptOrder(order: Order) {
    if (!agentId || accepting) return
    setAccepting(order.id)
    try {
      const res = await fetch('/api/delivery/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, agentId })
      })
      const data = await res.json()

      if (res.status === 409 || data.alreadyClaimed) {
        showToast('⚡ Order already taken! Refreshing...')
        await fetchAvailable()
        return
      }
      if (!res.ok) {
        showToast(`❌ ${data.error || 'Failed to accept order'}`)
        return
      }

      // Success — fetch full active order details
      const act = await fetchActive(agentId)
      setActiveOrder(act || { ...order, status: 'agent_assigned' })
      setAvailOrders([])
      showToast(`✅ Order ${order.order_number} accepted!`)
    } finally {
      setAccepting(null)
    }
  }

  async function updateStatus(orderId: string, status: string) {
    const now = new Date().toISOString()
    const extra = status === 'picked_up' ? { picked_up_at: now }
      : status === 'delivered' ? { delivered_at: now } : {}
    await supabase.from('orders').update({ status, ...extra }).eq('id', orderId)
    await supabase.from('order_status_history').insert({ order_id: orderId, status })

    if (status === 'delivered') {
      if (agentId && activeOrder) {
        try { await supabase.rpc('credit_agent_wallet', { p_agent_id: agentId, p_amount: activeOrder.agent_earning }) } catch {}
      }
      setActiveOrder(null)
      await fetchAvailable()
      showToast('🎉 Delivery complete! Earnings credited.')
    } else {
      setActiveOrder(prev => prev ? { ...prev, status } : null)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} /></div>
  if (noProfile) return <div style={{ textAlign: 'center', padding: '80px 20px' }}><div style={{ fontSize: '4rem', marginBottom: 16 }}>🛵</div><h2 style={{ marginBottom: 8 }}>Not Registered</h2><p style={{ marginBottom: 24 }}>Register as a delivery partner to start earning</p><a href="/delivery/register" className="btn btn-primary">Register Now →</a></div>
  if (!agent?.is_approved) return <div style={{ textAlign: 'center', padding: '80px 20px' }}><div style={{ fontSize: '4rem', marginBottom: 16 }}>⏳</div><h2 style={{ marginBottom: 8 }}>Awaiting Approval</h2><p>Your documents are under review. We&apos;ll notify you once approved.</p></div>

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'white', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontWeight: 600, fontSize: '0.92rem', animation: 'slideIn 0.25s ease' }}>
          {toast}
        </div>
      )}

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 28 }}>
        {[
          { icon: '💰', label: "Today's Earnings", value: `₹${agent?.today_earnings?.toFixed(0) || 0}`, color: '#22c55e' },
          { icon: '🏦', label: 'Wallet Balance', value: `₹${agent?.wallet_balance?.toFixed(0) || 0}`, color: '#f97316' },
          { icon: '📦', label: 'Total Deliveries', value: agent?.total_deliveries || 0, color: '#0ea5e9' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: `${s.color}20` }}>{s.icon}</div>
            <div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Active Order */}
      {activeOrder && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--primary)' }}>
          <h3 style={{ marginBottom: 16 }}>🔥 Active Order: {activeOrder.order_number}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--accent)' }}>🏪 Pick Up From</div>
              <div style={{ fontWeight: 600 }}>{activeOrder.shops?.name}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{activeOrder.shops?.address_line1}, {activeOrder.shops?.city}</div>
              {activeOrder.shops?.latitude > 0 && (
                <a href={`https://maps.google.com/?q=${activeOrder.shops.latitude},${activeOrder.shops.longitude}`} target="_blank" rel="noreferrer"
                  style={{ display: 'block', marginTop: 8, fontSize: '0.82rem', color: 'var(--accent)', background: 'var(--bg2)', padding: '6px 10px', borderRadius: 6 }}>
                  🗺️ Open in Maps
                </a>
              )}
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--success)' }}>🏠 Deliver To</div>
              <div style={{ fontWeight: 600 }}>{activeOrder.addresses?.house_name}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{activeOrder.addresses?.street_name}{activeOrder.addresses?.landmark ? `, near ${activeOrder.addresses.landmark}` : ''}, {activeOrder.addresses?.city}</div>
              {activeOrder.addresses?.latitude > 0 && (
                <a href={`https://maps.google.com/?q=${activeOrder.addresses.latitude},${activeOrder.addresses.longitude}`} target="_blank" rel="noreferrer"
                  style={{ display: 'block', marginTop: 8, fontSize: '0.82rem', color: 'var(--success)', background: 'var(--bg2)', padding: '6px 10px', borderRadius: 6 }}>
                  🗺️ Open in Maps
                </a>
              )}
            </div>
          </div>
          <div style={{ background: 'rgba(249,115,22,0.1)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.85rem' }}>
            <strong>Verify ID on Package:</strong> <span style={{ fontFamily: 'monospace', fontSize: '1rem', color: 'var(--primary)' }}>{activeOrder.order_number}</span>
          </div>
          <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 14 }}>Your Earning: ₹{activeOrder.agent_earning}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {activeOrder.status === 'agent_assigned' && <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => updateStatus(activeOrder.id, 'picked_up')}>✅ Picked Up</button>}
            {activeOrder.status === 'picked_up' && <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => updateStatus(activeOrder.id, 'out_for_delivery')}>🚴 Out for Delivery</button>}
            {activeOrder.status === 'out_for_delivery' && <button className="btn btn-success" style={{ flex: 1 }} onClick={() => updateStatus(activeOrder.id, 'delivered')}>🎉 Mark Delivered</button>}
          </div>
        </div>
      )}

      {/* Available Orders */}
      {!activeOrder && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>📦 Available Orders ({availOrders.length})</h3>
            <button onClick={fetchAvailable} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.82rem' }}>🔄 Refresh</button>
          </div>
          {availOrders.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
              <p>No orders available right now. Check back soon!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {availOrders.map(order => (
                <div key={order.id} className="card" style={{ borderLeft: '4px solid #22c55e' }}>
                  <div className="flex-between" style={{ marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{order.order_number}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        🏪 {order.shops?.name} → 🏠 {order.addresses?.city}
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, color: '#22c55e', fontSize: '1rem' }}>₹{order.agent_earning}</span>
                  </div>
                  <button
                    className="btn btn-primary btn-full"
                    disabled={accepting === order.id}
                    onClick={() => acceptOrder(order)}
                    style={{ background: '#16a34a', border: 'none' }}
                  >
                    {accepting === order.id ? '⏳ Accepting...' : '✅ Accept Delivery'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
