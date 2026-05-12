'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrderAlert } from '@/lib/useOrderAlert'

interface Shop { name: string; address_line1: string; city: string; latitude: number; longitude: number }
interface Address { house_name: string; street_name: string; landmark: string; city: string; latitude: number; longitude: number; phone?: string }
interface OrderItem { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_image_url: string }
interface Order {
  id: string; order_number: string; status: string; agent_earning: number
  total_amount: number; delivery_charge: number; created_at: string
  payment_method?: string
  shop: Shop; address: Address; items: OrderItem[]; distanceKm: number | null
}
interface AvailOrder {
  id: string; order_number: string; status: string; agent_earning: number
  shops: { name: string; city: string }; addresses: { city: string }
}
interface Agent { id: string; is_approved: boolean; is_available: boolean; wallet_balance: number; today_earnings: number; total_deliveries: number }

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function DeliveryDashboard() {
  const supabase = createClient()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [availOrders, setAvailOrders] = useState<AvailOrder[]>([])
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [noProfile, setNoProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [togglingAvail, setTogglingAvail] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const { start: startAlert, stop: stopAlert } = useOrderAlert()
  // Track excluded agent IDs for rejection-based reassignment chain
  const excludedAgentsRef = useRef<string[]>([])
  // Track the currently alerted order to avoid duplicate sounds
  const alertedOrderIdRef = useRef<string | null>(null)

  // Geolocation state for proximity lock
  const [agentLat, setAgentLat] = useState<number | null>(null)
  const [agentLon, setAgentLon] = useState<number | null>(null)
  const [gpsChecking, setGpsChecking] = useState(false)
  const [distToCustomer, setDistToCustomer] = useState<number | null>(null)
  const [distToShop, setDistToShop] = useState<number | null>(null)

  // OTP verification state
  const [otpInput, setOtpInput] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpLocked, setOtpLocked] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  // COD cash collection state
  const [codPending, setCodPending] = useState(false)
  const [codAmount, setCodAmount] = useState(0)
  const [codCollecting, setCodCollecting] = useState(false)
  const [codCollected, setCodCollected] = useState(false)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchAvailable = useCallback(async () => {
    const res = await fetch('/api/delivery/orders')
    const data = await res.json()
    setAvailOrders(data.orders || [])
  }, [])

  const fetchActive = useCallback(async (uid: string) => {
    const res = await fetch(`/api/delivery/active-order?agentId=${uid}`)
    const data = await res.json()
    return data.order as Order | null
  }, [])

  // Get agent's live GPS location
  function refreshGPS(order: Order) {
    if (!navigator.geolocation) return
    setGpsChecking(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        const acc = pos.coords.accuracy
        setAgentLat(lat)
        setAgentLon(lon)
        // Distance to CUSTOMER (for delivery proximity lock)
        if (order.address?.latitude > 0 && order.address?.longitude > 0) {
          const d = getDistanceKm(lat, lon, order.address.latitude, order.address.longitude)
          setDistToCustomer(parseFloat(d.toFixed(3)))
        }
        // Distance to SHOP (for pickup navigation)
        if (order.shop?.latitude > 0 && order.shop?.longitude > 0) {
          const ds = getDistanceKm(lat, lon, order.shop.latitude, order.shop.longitude)
          setDistToShop(parseFloat(ds.toFixed(3)))
        }
        setGpsChecking(false)
        if (acc > 100) {
          showToast(`⚠️ Your GPS accuracy is poor (±${Math.round(acc)}m). Distance reading may be inaccurate.`, false)
        }
      },
      err => {
        setGpsChecking(false)
        showToast('GPS failed: ' + (err.code === 1 ? 'Allow location access.' : 'Position unavailable.'), false)
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    )
  }

  useEffect(() => {
    if (!agentId) return
    function pushGPS() {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords
          supabase.from('delivery_agents').update({ last_lat: latitude, last_lon: longitude }).eq('id', agentId).then(() => {})
          if (activeOrder) {
            setAgentLat(latitude); setAgentLon(longitude)
            if (activeOrder.address?.latitude > 0 && activeOrder.address?.longitude > 0)
              setDistToCustomer(parseFloat(getDistanceKm(latitude, longitude, activeOrder.address.latitude, activeOrder.address.longitude).toFixed(3)))
            if (activeOrder.shop?.latitude > 0 && activeOrder.shop?.longitude > 0)
              setDistToShop(parseFloat(getDistanceKm(latitude, longitude, activeOrder.shop.latitude, activeOrder.shop.longitude).toFixed(3)))
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      )
    }
    pushGPS()
    const interval = setInterval(pushGPS, 30000)
    return () => clearInterval(interval)
  }, [agentId, activeOrder, supabase])

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
      if (!active && ag.is_available) await fetchAvailable()
      setLoading(false)
      if (active) refreshGPS(active)

      channel = supabase.channel(`delivery-live-${user.id}`)
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, async (payload) => {
        if (!mounted) return
        const act = await fetchActive(user.id)
        setActiveOrder(act)

        if (
          act &&
          payload.new?.agent_id === user.id &&
          payload.old?.agent_id !== user.id &&
          alertedOrderIdRef.current !== act.id
        ) {
          alertedOrderIdRef.current = act.id
          excludedAgentsRef.current = []
          startAlert()
          showToast('🔔 New delivery assigned to you!')
        }

        if (!act && ag.is_available) {
          await fetchAvailable()
          setDistToCustomer(null)
        } else if (act) {
          setAvailOrders([])
        }
      }).subscribe()
    }

    loadData()
    return () => { mounted = false; if (channel) { supabase.removeChannel(channel); channel = null } }
  }, [fetchAvailable, fetchActive, supabase])

  async function acceptOrder(order: AvailOrder) {
    if (!agentId || accepting) return
    setAccepting(order.id)
    stopAlert()   // stop any assignment alert
    alertedOrderIdRef.current = order.id // Prevent sound from playing when accepted manually
    try {
      const res = await fetch('/api/delivery/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, agentId })
      })
      const data = await res.json()
      if (res.status === 409 || data.alreadyClaimed) {
        showToast('⚡ Order already taken! Refreshing...', false)
        await fetchAvailable(); return
      }
      if (!res.ok) { showToast(`❌ ${data.error || 'Failed'}`, false); return }
      const act = await fetchActive(agentId)
      setActiveOrder(act)
      setAvailOrders([])
      if (act) refreshGPS(act)
      showToast(`✅ Order ${order.order_number} accepted!`)
    } finally { setAccepting(null) }
  }

  async function rejectOrder(order: AvailOrder) {
    if (!agentId || rejecting) return
    setRejecting(order.id)
    stopAlert()   // stop sound on reject
    alertedOrderIdRef.current = null
    // Remove from local list immediately for snappy UX
    setAvailOrders(prev => prev.filter(o => o.id !== order.id))
    showToast(`🚫 Order ${order.order_number} skipped.`, false)
    // Trigger reassignment — pass accumulated exclusion list to avoid re-assigning same agents
    try {
      excludedAgentsRef.current = [...excludedAgentsRef.current, agentId]
      await fetch('/api/delivery/reject-reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          agentId,
          excludeAgentIds: excludedAgentsRef.current
        })
      })
    } catch { /* non-critical — order will remain in order_packed state */ }
    setRejecting(null)
  }

  // ──── STATUS UPDATE — via server API (bypasses RLS) ────
  async function updateStatus(orderId: string, status: string) {
    if (!agentId || updatingStatus) return
    setUpdatingStatus(true)
    try {
      const res = await fetch('/api/delivery/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, agentId, status })
      })
      const data = await res.json()

      if (!res.ok) {
        showToast(`❌ ${data.error || 'Failed to update status'}`, false)
        return
      }

      if (status === 'delivered') {
        setActiveOrder(null)
        setDistToCustomer(null)
        setAgentLat(null); setAgentLon(null)
        setOtpInput(''); setOtpError('')
        await fetchAvailable()
        showToast('🎉 Delivery complete! Earnings credited.')
      } else {
        setActiveOrder(prev => prev ? { ...prev, status } : null)
        showToast(status === 'picked_up' ? '📦 Picked up from shop!' : '🚴 Out for delivery!')
      }
    } finally { setUpdatingStatus(false) }
  }

  // Is agent close enough to deliver? (within 100m OR no GPS coords saved for address)
  const noAddressGPS = !activeOrder?.address?.latitude || activeOrder.address.latitude === 0
  const withinRange = noAddressGPS || (distToCustomer !== null && distToCustomer <= 0.1)

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} /></div>
  if (noProfile) return <div style={{ textAlign: 'center', padding: '80px 20px' }}><div style={{ fontSize: '4rem', marginBottom: 16 }}>🛵</div><h2 style={{ marginBottom: 8 }}>Not Registered</h2><p style={{ marginBottom: 24 }}>Register as a delivery partner to start earning</p><a href="/delivery/register" className="btn btn-primary">Register Now →</a></div>
  if (!agent?.is_approved) return <div style={{ textAlign: 'center', padding: '80px 20px' }}><div style={{ fontSize: '4rem', marginBottom: 16 }}>⏳</div><h2 style={{ marginBottom: 8 }}>Awaiting Approval</h2><p>Your documents are under review. We&apos;ll notify you once approved.</p></div>

  return (
    <div className="dl-root">
      {/* Mobile Header */}
      <div className="dl-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.3rem' }}>🛵</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'white', lineHeight: 1.1 }}>Delivery Partner</div>
            <div style={{ fontSize: '0.7rem', color: agent?.is_available ? '#4ade80' : '#f87171' }}>
              {agent?.is_available ? '● Online' : '○ Offline'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>₹{agent?.wallet_balance?.toFixed(0) || 0}</span>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }} className="dl-logout-btn">Logout</button>
        </div>
      </div>
      {toast && (
        <div className={`dl-toast dl-toast-${toast.ok ? 'ok' : 'err'}`}>{toast.msg}</div>
      )}

      {/* Stats Row */}
      <div className="dl-stats-row">
        {[
          { icon: '💰', label: 'Today Earnings', value: `₹${agent?.today_earnings?.toFixed(0) || 0}`, color: '#22c55e', bg: '#f0fdf4' },
          { icon: '🏦', label: 'Wallet', value: `₹${agent?.wallet_balance?.toFixed(0) || 0}`, color: '#f97316', bg: '#fff7ed' },
          { icon: '📦', label: 'Deliveries', value: agent?.total_deliveries || 0, color: '#0ea5e9', bg: '#f0f9ff' },
        ].map(s => (
          <div key={s.label} className="dl-stat-card" style={{ background: s.bg }}>
            <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{s.icon}</div>
            <div className="dl-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="dl-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Availability Status Toggle ── */}
      {!activeOrder && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: agent?.is_available ? '#f0fdf4' : '#fef2f2',
          border: `1.5px solid ${agent?.is_available ? '#86efac' : '#fca5a5'}`,
          borderRadius: 12, padding: '14px 18px', marginBottom: 20, gap: 12, flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.8rem' }}>{agent?.is_available ? '🟢' : '🔴'}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: agent?.is_available ? '#15803d' : '#dc2626' }}>
                You are {agent?.is_available ? 'ONLINE' : 'OFFLINE'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                {agent?.is_available
                  ? 'You will receive delivery orders.'
                  : 'Toggle to go online and start receiving orders.'}
              </div>
            </div>
          </div>
          <button
            disabled={togglingAvail}
            onClick={async () => {
              if (!agentId || !agent) return
              const next = !agent.is_available
              const confirmed = window.confirm(
                next
                  ? 'Go ONLINE? You will start receiving delivery orders.'
                  : 'Go OFFLINE? You will stop receiving new orders until you come back online.'
              )
              if (!confirmed) return
              setTogglingAvail(true)
              const { error } = await supabase
                .from('delivery_agents')
                .update({ is_available: next })
                .eq('id', agentId)
              if (error) {
                showToast('❌ Failed to update status.', false)
              } else {
                setAgent(a => a ? { ...a, is_available: next } : a)
                if (next) await fetchAvailable()
                else setAvailOrders([])
                showToast(next ? '🟢 You are now ONLINE!' : '🔴 You are now OFFLINE.')
              }
              setTogglingAvail(false)
            }}
            style={{
              background: agent?.is_available ? '#dc2626' : '#16a34a',
              color: 'white', border: 'none', borderRadius: 10,
              padding: '10px 20px', fontWeight: 800, fontSize: '0.9rem',
              cursor: togglingAvail ? 'not-allowed' : 'pointer',
              opacity: togglingAvail ? 0.6 : 1, whiteSpace: 'nowrap'
            }}
          >
            {togglingAvail ? '⏳ Updating...' : agent?.is_available ? '🔴 Go Offline' : '🟢 Go Online'}
          </button>
        </div>
      )}

      {/* ── Active Order ── */}
      {activeOrder && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {/* Order Header Card */}
          <div className="dl-active-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>#{activeOrder.order_number}</div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                  {activeOrder.status === 'agent_assigned' ? '📦 Ready for Pickup' : 
                   activeOrder.status === 'picked_up' ? '🚴 Picked Up' : 
                   activeOrder.status === 'out_for_delivery' ? '🏠 Out for Delivery' : 'Active Delivery'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color: '#4ade80', fontSize: '1.1rem' }}>₹{activeOrder.agent_earning}</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Your Earnings</div>
              </div>
            </div>
          </div>

          {/* Shop → Customer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="dl-location-card" style={{ borderTop: '3px solid #f97316' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#f97316', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>🏪 PICKUP</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4 }}>{activeOrder.shop?.name || '—'}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                {activeOrder.shop?.address_line1 ? `${activeOrder.shop.address_line1}, ` : ''}{activeOrder.shop?.city || ''}
              </div>
              {distToShop !== null && (
                <div style={{
                  marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontWeight: 700, fontSize: '0.7rem', padding: '3px 8px', borderRadius: 99,
                  background: distToShop < 0.5 ? '#f0fdf4' : distToShop < 2 ? '#fef3c7' : '#fef2f2',
                  color: distToShop < 0.5 ? '#16a34a' : distToShop < 2 ? '#d97706' : '#dc2626',
                }}>
                  📍 {distToShop < 1 ? `${Math.round(distToShop * 1000)}m` : `${distToShop.toFixed(1)}km`}
                </div>
              )}
              {(activeOrder.shop?.latitude > 0) && (
                <a href={`https://maps.google.com/?q=${activeOrder.shop.latitude},${activeOrder.shop.longitude}`} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: '0.72rem', color: '#f97316', fontWeight: 700, background: '#fff7ed', padding: '4px 8px', borderRadius: 6, textDecoration: 'none' }}>
                  🗺️ Navigate
                </a>
              )}
            </div>

            <div className="dl-location-card" style={{ borderTop: '3px solid #22c55e' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#16a34a', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>🏠 DELIVER</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4 }}>{activeOrder.address?.house_name || '—'}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                {activeOrder.address?.street_name || ''}{activeOrder.address?.landmark ? `, ${activeOrder.address.landmark}` : ''}
              </div>
              {distToCustomer !== null && (
                <div style={{
                  marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontWeight: 700, fontSize: '0.7rem', padding: '3px 8px', borderRadius: 99,
                  background: distToCustomer < 0.1 ? '#f0fdf4' : distToCustomer < 0.5 ? '#fef3c7' : '#fef2f2',
                  color: distToCustomer < 0.1 ? '#16a34a' : distToCustomer < 0.5 ? '#d97706' : '#dc2626',
                }}>
                  📍 {distToCustomer < 1 ? `${Math.round(distToCustomer * 1000)}m` : `${distToCustomer.toFixed(1)}km`}
                </div>
              )}
              <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                {(activeOrder.address?.latitude > 0) ? (
                  <a href={`https://maps.google.com/?q=${activeOrder.address.latitude},${activeOrder.address.longitude}`} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '4px 8px', borderRadius: 6, textDecoration: 'none' }}>
                    🗺️
                  </a>
                ) : (
                  <a href={`https://maps.google.com/search?q=${encodeURIComponent(`${activeOrder.address?.house_name || ''} ${activeOrder.address?.street_name || ''} ${activeOrder.address?.city || ''}`)}`} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '4px 8px', borderRadius: 6, textDecoration: 'none' }}>
                    🔍
                  </a>
                )}
                {activeOrder.address?.phone && (
                  <a href={`tel:${activeOrder.address.phone}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#2563eb', fontWeight: 700, background: '#eff6ff', padding: '4px 8px', borderRadius: 6, textDecoration: 'none' }}>
                    📞
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Items checklist */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>📋 Items to Verify ({activeOrder.items?.length || 0})</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Check all packed correctly</span>
            </div>
            {!activeOrder.items || activeOrder.items.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No item details available</div>
            ) : (
              activeOrder.items.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: idx < activeOrder.items.length - 1 ? '1px solid var(--border)' : 'none', background: idx % 2 === 0 ? 'white' : 'var(--bg)' }}>
                  {item.product_image_url
                    ? <img src={item.product_image_url} alt={item.product_name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 40, height: 40, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>📦</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.product_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>₹{item.unit_price} × {item.quantity}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--primary)' }}>×{item.quantity}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Action Buttons Section */}
          <div className="dl-action-section">
            {/* Order Verification */}
            <div style={{ background: '#fff7ed', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '0.85rem' }}>
              <strong>Verify Order ID:</strong>{' '}
              <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontSize: '1rem', fontWeight: 700 }}>{activeOrder.order_number}</span>
            </div>

            {/* Status Buttons */}
            {activeOrder.status === 'agent_assigned' && (
              <button className="dl-primary-btn" disabled={updatingStatus} onClick={() => updateStatus(activeOrder.id, 'picked_up')}>
                {updatingStatus ? '⏳ Processing...' : '📦 Mark as Picked Up'}
              </button>
            )}
            {activeOrder.status === 'picked_up' && (
              <button className="dl-primary-btn" disabled={updatingStatus} onClick={() => updateStatus(activeOrder.id, 'out_for_delivery')}>
                {updatingStatus ? '⏳ Processing...' : '🚴 Start Delivery'}
              </button>
            )}
            {activeOrder.status === 'out_for_delivery' && (
              <div>
                {/* Proximity indicator */}
                {activeOrder.address?.latitude > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{
                      padding: '10px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
                      background: withinRange ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${withinRange ? '#86efac' : '#fca5a5'}`,
                      color: withinRange ? '#16a34a' : '#dc2626',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <span>
                        {distToCustomer !== null
                          ? `📍 ${(distToCustomer * 1000).toFixed(0)}m away ${withinRange ? '✅ Ready' : '— Get closer'}`
                          : '📡 Getting location...'}
                      </span>
                      <button onClick={() => refreshGPS(activeOrder)} disabled={gpsChecking}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700 }}>
                        {gpsChecking ? '⏳' : '🔄'}
                      </button>
                    </div>
                  </div>
                )}

                {/* OTP Entry — ask customer for their code */}
                {withinRange || !activeOrder.address?.latitude ? (
                  <div style={{ border: '2.5px solid #22c55e', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.1)', borderBottom: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.2rem' }}>🔐</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#16a34a' }}>Enter Customer Delivery Code</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ask customer to show the 4-digit code from their app</div>
                      </div>
                    </div>
                    <div style={{ padding: 16 }}>
                      <input
                        type="tel"
                        maxLength={4}
                        pattern="[0-9]{4}"
                        placeholder="----"
                        value={otpInput}
                        disabled={otpLocked || otpVerifying}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                          setOtpInput(v)
                          setOtpError('')
                        }}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          fontSize: '2.5rem', fontWeight: 800, letterSpacing: '0.8em',
                          textAlign: 'center', fontFamily: 'monospace',
                          border: `2px solid ${otpError ? '#ef4444' : '#22c55e'}`,
                          borderRadius: 10, padding: '12px 8px',
                          background: otpLocked ? '#f1f5f9' : 'white',
                          color: otpLocked ? '#94a3b8' : '#16a34a',
                          outline: 'none', marginBottom: 10,
                          cursor: otpLocked ? 'not-allowed' : 'text',
                        }}
                      />
                      {otpError && (
                        <div style={{ fontSize: '0.82rem', color: '#dc2626', background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: 8, marginBottom: 10, textAlign: 'center', fontWeight: 600 }}>
                          ❌ {otpError}
                        </div>
                      )}
                      <button
                        className="btn btn-success btn-full"
                        disabled={otpInput.length !== 4 || otpVerifying || otpLocked}
                        style={{ opacity: (otpInput.length === 4 && !otpLocked) ? 1 : 0.5 }}
                        onClick={async () => {
                          if (!agentId || otpInput.length !== 4) return
                          setOtpVerifying(true)
                          try {
                            const res = await fetch('/api/delivery/verify-otp', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ orderId: activeOrder.id, agentId, enteredOtp: otpInput })
                            })
                            const data = await res.json()
                            if (data.success) {
                              if (data.isCod) {
                                // COD: show cash collection UI
                                setCodPending(true)
                                setCodAmount(data.amount)
                                showToast('✅ OTP verified! Now collect cash from customer.')
                              } else {
                                setActiveOrder(null)
                                setDistToCustomer(null)
                                setOtpInput(''); setOtpError('')
                                await fetchAvailable()
                                showToast('🎉 Delivery verified & complete!')
                              }
                            } else if (data.locked) {
                              setOtpLocked(true)
                              setOtpError(data.error || 'Locked — too many wrong attempts')
                            } else {
                              setOtpError(data.error || 'Invalid code')
                            }
                          } finally { setOtpVerifying(false) }
                        }}
                      >
                        {otpVerifying ? '⏳ Verifying...' : otpLocked ? '🔒 Locked' : '✅ Verify & Mark Delivered'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => refreshGPS(activeOrder)} className="btn btn-secondary btn-full">
                    📡 Get My Location to Continue
                  </button>
                )}

                {/* COD Collection UI — QR or Cash */}
                {codPending && (
                  <div style={{ marginTop: 16, border: '2.5px solid #f59e0b', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: '#fef3c7', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.4rem' }}>💵</span>
                      <div>
                        <div style={{ fontWeight: 800, color: '#92400e', fontSize: '1rem' }}>Collect ₹{codAmount} from Customer</div>
                        <div style={{ fontSize: '0.72rem', color: '#78350f' }}>Choose how customer pays</div>
                      </div>
                    </div>
                    <div style={{ padding: 16, background: 'white' }}>
                      {/* Option 1 — QR/UPI */}
                      {process.env.NEXT_PUBLIC_PLATFORM_UPI_ID && (
                        <div style={{ marginBottom: 16, padding: 14, border: '2px solid #e2e8f0', borderRadius: 12 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>📱 Option 1 — UPI / QR Payment</div>
                          <div style={{ textAlign: 'center', marginBottom: 10 }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>Ask customer to scan &amp; pay directly to platform</div>
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${process.env.NEXT_PUBLIC_PLATFORM_UPI_ID}&pn=VarunsOnline&am=${codAmount}&cu=INR&tn=Order%20${activeOrder.order_number}`)}`}
                              alt="UPI QR" style={{ width: 200, height: 200, borderRadius: 10, border: '2px solid #e2e8f0', display: 'block', margin: '0 auto' }}
                            />
                            <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>UPI: {process.env.NEXT_PUBLIC_PLATFORM_UPI_ID} · ₹{codAmount}</p>
                          </div>
                          <button
                            disabled={codCollecting}
                            onClick={async () => {
                              if (!agentId) return
                              setCodCollecting(true)
                              try {
                                const res = await fetch('/api/delivery/collect-cash', {
                                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ orderId: activeOrder.id, agentId, paymentMethod: 'qr' })
                                })
                                const data = await res.json()
                                if (data.success) {
                                  setCodPending(false)
                                  setAgent(prev => prev ? { ...prev, wallet_balance: data.newWalletBalance } : prev)
                                  setActiveOrder(null); setDistToCustomer(null)
                                  await fetchAvailable()
                                  showToast('✅ UPI payment confirmed & delivery complete!')
                                } else showToast(data.error || 'Failed', false)
                              } finally { setCodCollecting(false) }
                            }}
                            style={{ width: '100%', padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem', opacity: codCollecting ? 0.6 : 1 }}
                          >
                            {codCollecting ? '⏳...' : '✅ Customer Paid via UPI — Mark Complete'}
                          </button>
                        </div>
                      )}
                      {/* Option 2 — Cash */}
                      <div style={{ padding: 14, border: '2px solid #fde68a', borderRadius: 12 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 6, color: '#0f172a' }}>💵 Option 2 — Cash Collection</div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 10 }}>Collect ₹{codAmount} cash physically. Amount will be debited from your wallet — settle later via Wallet page.</p>
                        <button
                          disabled={codCollecting}
                          onClick={async () => {
                            if (!agentId) return
                            setCodCollecting(true)
                            try {
                              const res = await fetch('/api/delivery/collect-cash', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ orderId: activeOrder.id, agentId, paymentMethod: 'cash' })
                              })
                              const data = await res.json()
                              if (data.success) {
                                setCodPending(false)
                                setAgent(prev => prev ? { ...prev, wallet_balance: data.newWalletBalance } : prev)
                                setActiveOrder(null); setDistToCustomer(null)
                                await fetchAvailable()
                                showToast(data.newWalletBalance < 0
                                  ? `⚠️ Cash recorded! Remit ₹${Math.abs(data.newWalletBalance)} via Wallet page`
                                  : '✅ Cash collected & recorded!', data.newWalletBalance >= 0)
                              } else showToast(data.error || 'Failed', false)
                            } finally { setCodCollecting(false) }
                          }}
                          style={{ width: '100%', padding: '10px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem', opacity: codCollecting ? 0.6 : 1 }}
                        >
                          {codCollecting ? '⏳ Recording...' : '💵 Collected Cash — Mark Delivered'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Available Orders ── */}
      {!activeOrder && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.1rem' }}>📦 Available Orders ({availOrders.length})</h3>
            <button onClick={fetchAvailable} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem', padding: '6px 12px', borderRadius: 8, background: 'rgba(249,115,22,0.1)' }}>🔄 Refresh</button>
          </div>
          {/* Offline warning */}
          {!agent?.is_available ? (
            <div className="dl-offline-card">
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔴</div>
              <h4 style={{ marginBottom: 8, color: '#f97316' }}>You are Offline</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Go to <strong>Profile</strong> and toggle Availability to <strong>Online</strong> to receive orders.</p>
            </div>
          ) : availOrders.length === 0 ? (
            <div className="dl-empty-card">
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
              <p>No orders available. Check back soon!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {availOrders.map((order: AvailOrder) => (
                <div key={order.id} className="dl-avail-card">
                  <div className="dl-avail-top">
                    <div style={{ flex: 1 }}>
                      <div className="dl-avail-num">#{order.order_number}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                        <span style={{ color: '#f97316' }}>🏪</span> {order.shops?.name} → <span style={{ color: '#16a34a' }}>🏠</span> {order.addresses?.city}
                      </div>
                      {(order as AvailOrder & { distShopToCustomer?: number }).distShopToCustomer != null && (
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                          🗺️ {(order as AvailOrder & { distShopToCustomer?: number }).distShopToCustomer! < 1
                            ? `${Math.round((order as AvailOrder & { distShopToCustomer?: number }).distShopToCustomer! * 1000)}m`
                            : `${(order as AvailOrder & { distShopToCustomer?: number }).distShopToCustomer!.toFixed(1)}km`} trip
                        </div>
                      )}
                    </div>
                    <div className="dl-avail-earn">₹{order.agent_earning}</div>
                  </div>
                  <div className="dl-avail-actions">
                    <button className="dl-accept-btn" disabled={accepting === order.id || !!rejecting} onClick={() => acceptOrder(order)}>
                      {accepting === order.id ? '⏳ Accepting...' : '✓ Accept'}
                    </button>
                    <button className="dl-reject-btn" disabled={rejecting === order.id || !!accepting} onClick={() => rejectOrder(order)}>✕ Skip</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`
        .dl-root { min-height: 100%; }
        .dl-mobile-header { display: none; }
        .dl-stats-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; padding: 16px 16px 0; margin-bottom: 16px; }
        .dl-stat-card { background: white; border: 1.5px solid var(--border); border-radius: 12px; padding: 12px 10px; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .dl-stat-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
        .dl-stat-value { font-size: 1.1rem; font-weight: 800; color: #0f172a; line-height: 1.2; margin-top: 4px; }
        .dl-stat-label { font-size: 0.65rem; color: #64748b; font-weight: 600; }
        .dl-toast { position: fixed; z-index: 9999; top: calc(16px + env(safe-area-inset-top,0px)); left: 12px; right: 12px; border-radius: 10px; padding: 12px 18px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); font-weight: 600; font-size: 0.9rem; text-align: center; animation: fadeIn 0.2s ease; }
        .dl-toast-ok  { background: #f0fdf4; border: 1.5px solid #22c55e; color: #15803d; }
        .dl-toast-err { background: #fef2f2; border: 1.5px solid #ef4444; color: #dc2626; }
        .dl-active-header { background: linear-gradient(135deg, #0f172a, #1e293b); border-radius: 14px; padding: 16px; margin-bottom: 12px; }
        .dl-location-card { background: white; border-radius: 12px; padding: 12px; }
        .dl-action-section { background: white; border-radius: 12px; padding: 14px; }
        .dl-primary-btn { width: 100%; padding: 16px; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 1rem; cursor: pointer; }
        .dl-primary-btn:disabled { opacity: 0.6; }
        .dl-avail-card { background: white; border: 1.5px solid #e2e8f0; border-left: 4px solid #22c55e; border-radius: 12px; overflow: hidden; }
        .dl-offline-card { background: #fef2f2; border: 2px solid #fca5a5; border-radius: 14px; padding: 30px; text-align: center; }
        .dl-empty-card { background: white; border: 1.5px solid var(--border); border-radius: 14px; padding: 30px; text-align: center; }
        .dl-avail-top { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 14px 8px; gap: 10px; }
        .dl-avail-num { font-weight: 800; fontSize: 0.95rem; color: #0f172a; }
        .dl-avail-earn { font-weight: 800; color: #16a34a; font-size: 1.2rem; flex-shrink: 0; }
        .dl-avail-actions { display: flex; border-top: 1px solid #f1f5f9; }
        .dl-accept-btn { flex: 1; min-height: 50px; background: #16a34a; color: white; border: none; font-weight: 700; font-size: 0.95rem; cursor: pointer; }
        .dl-accept-btn:active { background: #15803d; }
        .dl-accept-btn:disabled { opacity: 0.6; }
        .dl-reject-btn { width: 70px; min-height: 50px; background: #fef2f2; color: #dc2626; border: none; border-left: 1px solid #fecaca; font-weight: 600; font-size: 0.85rem; cursor: pointer; flex-shrink: 0; }
        .dl-reject-btn:active { background: #fee2e2; }
        .dl-reject-btn:disabled { opacity: 0.5; }
        @media (max-width: 768px) {
          .dl-mobile-header { display: flex !important; align-items: center; justify-content: space-between; background: #0f172a; padding: 12px 16px; padding-top: calc(12px + env(safe-area-inset-top,0px)); position: sticky; top: 0; z-index: 30; }
          .dl-logout-btn { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); color: white; border-radius: 8px; padding: 6px 12px; font-size: 0.72rem; font-weight: 700; cursor: pointer; }
          .dl-stats-row { padding: 12px 12px 0; gap: 8px; margin-bottom: 10px; }
          .dl-stat-card { padding: 10px 8px; border-radius: 10px; }
          .dl-stat-value { font-size: 1rem; }
          .dl-stat-label { font-size: 0.6rem; }
        }
      `}</style>
    </div>
  )
}
