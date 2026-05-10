'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Shop { name: string; address_line1: string; city: string; latitude: number; longitude: number }
interface Address { house_name: string; street_name: string; landmark: string; city: string; latitude: number; longitude: number; phone?: string }
interface OrderItem { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_image_url: string }
interface Order {
  id: string; order_number: string; status: string; agent_earning: number
  total_amount: number; delivery_charge: number; created_at: string
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
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Geolocation state for proximity lock
  const [agentLat, setAgentLat] = useState<number | null>(null)
  const [agentLon, setAgentLon] = useState<number | null>(null)
  const [gpsChecking, setGpsChecking] = useState(false)
  const [distToCustomer, setDistToCustomer] = useState<number | null>(null)

  // OTP verification state
  const [otpInput, setOtpInput] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpLocked, setOtpLocked] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)

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
        setAgentLat(lat)
        setAgentLon(lon)
        if (order.address?.latitude > 0 && order.address?.longitude > 0) {
          const d = getDistanceKm(lat, lon, order.address.latitude, order.address.longitude)
          setDistToCustomer(parseFloat(d.toFixed(3)))
        }
        setGpsChecking(false)
      },
      () => setGpsChecking(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

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
      if (!active) await fetchAvailable()
      setLoading(false)

      // Auto-get GPS if there's an active order
      if (active) refreshGPS(active)

      channel = supabase.channel(`delivery-live-${user.id}`)
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, async () => {
        if (!mounted) return
        const act = await fetchActive(user.id)
        setActiveOrder(act)
        if (!act) { await fetchAvailable(); setDistToCustomer(null) }
        else setAvailOrders([])
      }).subscribe()
    }

    loadData()
    return () => { mounted = false; if (channel) { supabase.removeChannel(channel); channel = null } }
  }, [fetchAvailable, fetchActive, supabase])

  async function acceptOrder(order: AvailOrder) {
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
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'white',
          border: `1.5px solid ${toast.ok ? '#22c55e' : '#ef4444'}`,
          borderRadius: 10, padding: '12px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontWeight: 600, fontSize: '0.92rem'
        }}>
          {toast.msg}
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

      {/* ── Active Order ── */}
      {activeOrder && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>

          {/* Header */}
          <div className="card" style={{ borderLeft: '4px solid var(--primary)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>🔥 {activeOrder.order_number}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>Active Delivery</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color: 'var(--success)', fontSize: '1rem' }}>₹{activeOrder.agent_earning} earn</div>
                {activeOrder.distanceKm !== null && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700, marginTop: 2 }}>📍 {activeOrder.distanceKm} km trip</div>
                )}
              </div>
            </div>
          </div>

          {/* Shop → Customer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card" style={{ padding: 14, borderTop: '3px solid #f97316' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#f97316', fontSize: '0.82rem', textTransform: 'uppercase' }}>🏪 Pick Up</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{activeOrder.shop?.name || '—'}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {activeOrder.shop?.address_line1 ? `${activeOrder.shop.address_line1}, ` : ''}{activeOrder.shop?.city || ''}
              </div>
              {(activeOrder.shop?.latitude > 0) && (
                <a href={`https://maps.google.com/?q=${activeOrder.shop.latitude},${activeOrder.shop.longitude}`} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: '0.78rem', color: '#f97316', fontWeight: 700, background: '#fff7ed', padding: '5px 10px', borderRadius: 6, textDecoration: 'none' }}>
                  🗺️ Open Maps
                </a>
              )}
            </div>

            <div className="card" style={{ padding: 14, borderTop: '3px solid #22c55e' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#16a34a', fontSize: '0.82rem', textTransform: 'uppercase' }}>🏠 Deliver To</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{activeOrder.address?.house_name || '—'}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {activeOrder.address?.street_name || ''}{activeOrder.address?.landmark ? `, near ${activeOrder.address.landmark}` : ''}{activeOrder.address?.city ? `, ${activeOrder.address.city}` : ''}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {(activeOrder.address?.latitude > 0) ? (
                  <a href={`https://maps.google.com/?q=${activeOrder.address.latitude},${activeOrder.address.longitude}`} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '5px 10px', borderRadius: 6, textDecoration: 'none' }}>
                    🗺️ Open Maps
                  </a>
                ) : (
                  <a href={`https://maps.google.com/search?q=${encodeURIComponent(`${activeOrder.address?.house_name || ''} ${activeOrder.address?.street_name || ''} ${activeOrder.address?.city || ''}`)}`} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '5px 10px', borderRadius: 6, textDecoration: 'none' }}>
                    🔍 Search Maps
                  </a>
                )}
                {activeOrder.address?.phone && (
                  <a href={`tel:${activeOrder.address.phone}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#2563eb', fontWeight: 700, background: '#eff6ff', padding: '5px 10px', borderRadius: 6, textDecoration: 'none' }}>
                    📞 {activeOrder.address.phone}
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

          {/* Proximity check + Action */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ background: '#fff7ed', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.85rem' }}>
              <strong>Verify Order ID on Package:</strong>{' '}
              <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontSize: '1rem' }}>{activeOrder.order_number}</span>
            </div>

            {/* Proximity indicator — only show for Mark Delivered step */}
            {activeOrder.status === 'out_for_delivery' && activeOrder.address?.latitude > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  padding: '10px 14px', borderRadius: 8, fontSize: '0.83rem', fontWeight: 600,
                  background: withinRange ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${withinRange ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
                  color: withinRange ? '#16a34a' : '#dc2626',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span>
                    {distToCustomer !== null
                      ? `📍 ${(distToCustomer * 1000).toFixed(0)}m from customer ${withinRange ? '✅ In range' : '— move closer!'}`
                      : '📡 Checking your location...'}
                  </span>
                  <button onClick={() => refreshGPS(activeOrder)} disabled={gpsChecking}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700 }}>
                    {gpsChecking ? '⏳' : '🔄'}
                  </button>
                </div>
                {!withinRange && distToCustomer !== null && (
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
                    You must be within <strong>100m</strong> of the delivery address to mark as Delivered.
                  </p>
                )}
              </div>
            )}

            {activeOrder.status === 'agent_assigned' && (
              <button className="btn btn-primary btn-full" disabled={updatingStatus} onClick={() => updateStatus(activeOrder.id, 'picked_up')}>
                {updatingStatus ? '⏳ Updating...' : '✅ Picked Up from Shop'}
              </button>
            )}
            {activeOrder.status === 'picked_up' && (
              <button className="btn btn-primary btn-full" disabled={updatingStatus} onClick={() => updateStatus(activeOrder.id, 'out_for_delivery')}>
                {updatingStatus ? '⏳ Updating...' : '🚴 Out for Delivery'}
              </button>
            )}
            {activeOrder.status === 'out_for_delivery' && (
              <div>
                {/* Proximity indicator */}
                {activeOrder.address?.latitude > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{
                      padding: '10px 14px', borderRadius: 8, fontSize: '0.83rem', fontWeight: 600,
                      background: withinRange ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${withinRange ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
                      color: withinRange ? '#16a34a' : '#dc2626',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <span>
                        {distToCustomer !== null
                          ? `📍 ${(distToCustomer * 1000).toFixed(0)}m from customer ${withinRange ? '✅ In range' : '— move closer!'}`
                          : '📡 Checking your location...'}
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
                              setActiveOrder(null)
                              setDistToCustomer(null)
                              setOtpInput(''); setOtpError('')
                              await fetchAvailable()
                              showToast('🎉 Delivery verified & complete!')
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Available Orders ── */}
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
              {availOrders.map((order: AvailOrder) => (
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
                  <button className="btn btn-primary btn-full" disabled={accepting === order.id} onClick={() => acceptOrder(order)} style={{ background: '#16a34a', border: 'none' }}>
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
