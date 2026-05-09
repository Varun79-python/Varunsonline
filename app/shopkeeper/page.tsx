'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Shop { id: string; name: string; is_approved: boolean; is_active: boolean; wallet_balance: number; total_earnings: number; total_orders: number; rating: number }
interface Order { id: string; order_number: string; status: string; total_amount: number; created_at: string; customer_id: string }

export default function ShopkeeperDashboard() {
  const supabase = createClient()
  const [shop, setShop] = useState<Shop | null>(null)
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [todayEarnings, setTodayEarnings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [noShop, setNoShop] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

      const today = new Date().toISOString().split('T')[0]
      const { data: todayOrders } = await supabase.from('orders').select('shopkeeper_earning').eq('shop_id', shopData.id).eq('payment_status', 'paid').gte('created_at', today)
      const { data: pending } = await supabase.from('orders').select('*').eq('shop_id', shopData.id).eq('status', 'payment_confirmed').order('created_at', { ascending: false })
      if (!mounted) return
      setTodayEarnings(todayOrders?.reduce((s: number, o: { shopkeeper_earning: number }) => s + o.shopkeeper_earning, 0) || 0)
      setPendingOrders(pending || [])
      setLoading(false)

      channel = supabase.channel(`shop-orders-${shopData.id}`)
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopData.id}` }, payload => {
        setPendingOrders(prev => [payload.new as Order, ...prev])
        playAlert()
      }).subscribe()
    }

    loadData()
    return () => { mounted = false; if (channel) { supabase.removeChannel(channel); channel = null } }
  }, [])

  function playAlert() {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880; gain.gain.value = 0.3
      osc.start(); osc.stop(ctx.currentTime + 0.3)
      setTimeout(() => { osc.frequency.value = 660; osc.start(); osc.stop(ctx.currentTime + 0.3) }, 400)
    } catch {}
  }

  async function acceptOrder(orderId: string) {
    await supabase.from('orders').update({ status: 'shop_accepted', accepted_at: new Date().toISOString() }).eq('id', orderId)
    await supabase.from('order_status_history').insert({ order_id: orderId, status: 'shop_accepted' })
    setPendingOrders(prev => prev.filter(o => o.id !== orderId))
  }

  async function rejectOrder(orderId: string) {
    const reason = prompt('Reason for rejection?')
    await supabase.from('orders').update({ status: 'rejected', rejection_reason: reason }).eq('id', orderId)
    setPendingOrders(prev => prev.filter(o => o.id !== orderId))
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
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{shop?.name}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className={`badge ${shop?.is_active ? 'badge-green' : 'badge-gray'}`}>{shop?.is_active ? '● Active' : '● Inactive'}</span>
            {shop?.rating && shop.rating > 0 && <span className="badge badge-yellow">⭐ {shop.rating}</span>}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => supabase.from('shops').update({ is_open: true }).eq('id', shop?.id)}>
          🔄 Toggle Open/Close
        </button>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {[
          { icon: '💰', label: "Today's Earnings", value: `₹${todayEarnings.toFixed(0)}`, color: '#22c55e' },
          { icon: '🏦', label: 'Wallet Balance', value: `₹${shop?.wallet_balance?.toFixed(0)}`, color: '#f97316' },
          { icon: '📦', label: 'Total Orders', value: shop?.total_orders || 0, color: '#0ea5e9' },
          { icon: '💼', label: 'Total Earned', value: `₹${shop?.total_earnings?.toFixed(0)}`, color: '#a855f7' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: `${s.color}20` }}><span>{s.icon}</span></div>
            <div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Pending Orders */}
      <h3 style={{ marginBottom: 16 }}>🔔 Incoming Orders {pendingOrders.length > 0 && <span className="badge badge-orange" style={{ marginLeft: 8 }}>{pendingOrders.length}</span>}</h3>
      {pendingOrders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
          <p>No pending orders. All caught up!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingOrders.map(order => (
            <div key={order.id} className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <div className="flex-between" style={{ marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{order.order_number}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{new Date(order.created_at).toLocaleTimeString('en-IN')}</div>
                </div>
                <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem' }}>₹{order.total_amount}</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => acceptOrder(order.id)}>✅ Accept</button>
                <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => rejectOrder(order.id)}>❌ Reject</button>
                <a href={`/shopkeeper/orders/${order.id}`} className="btn btn-secondary btn-sm">View →</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
