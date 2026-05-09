'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Order {
  id: string; order_number: string; status: string; total_amount: number
  created_at: string; shop_id: string; shops: { name: string }
}

const STATUS_LABEL: Record<string, string> = {
  placed: '📋 Placed', payment_pending: '💳 Payment Pending',
  payment_confirmed: '✅ Payment Confirmed', shop_accepted: '🏪 Shop Accepted',
  order_packed: '📦 Order Packed', agent_assigned: '🛵 Agent Assigned',
  picked_up: '🏃 Picked Up', out_for_delivery: '🚴 Out for Delivery',
  delivered: '✅ Delivered', cancelled: '❌ Cancelled', rejected: '❌ Rejected'
}

const STATUS_COLOR: Record<string, string> = {
  delivered: 'badge-green', cancelled: 'badge-red', rejected: 'badge-red',
  out_for_delivery: 'badge-blue', order_packed: 'badge-orange', shop_accepted: 'badge-orange'
}

export default function OrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) return

      const { data } = await supabase
        .from('orders')
        .select('*, shops(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (!mounted) return  // cleanup ran while awaiting — bail out
      setOrders(data || [])
      setLoading(false)

      channel = supabase.channel(`customer-orders-${user.id}`)
      channel
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'orders',
          filter: `customer_id=eq.${user.id}`
        }, payload => {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o))
        })
        .subscribe()
    }

    load()

    return () => {
      mounted = false
      if (channel) { supabase.removeChannel(channel); channel = null }
    }
  }, [])



  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} /></div>

  if (orders.length === 0) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>📦</div>
      <h2 style={{ marginBottom: 8 }}>No orders yet</h2>
      <p style={{ marginBottom: 24 }}>Place your first order from a nearby shop!</p>
      <button className="btn btn-primary" onClick={() => router.push('/customer')}>Browse Shops</button>
    </div>
  )

  return (
    <div className="fade-in">
      <h2 style={{ marginBottom: 24 }}>📦 My Orders</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {orders.map(order => (
          <div key={order.id} className="card" style={{ cursor: 'pointer' }} onClick={() => router.push(`/customer/orders/${order.id}`)}>
            <div className="flex-between" style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{order.order_number}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{order.shops?.name}</div>
              </div>
              <span className={`badge ${STATUS_COLOR[order.status] || 'badge-gray'}`}>{STATUS_LABEL[order.status] || order.status}</span>
            </div>
            <div className="flex-between">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{order.total_amount}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
