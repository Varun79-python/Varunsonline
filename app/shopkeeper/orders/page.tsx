'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Order {
  id: string; order_number: string; status: string; total_amount: number
  created_at: string; shopkeeper_earning: number
}

const STATUS_TABS = ['all', 'payment_confirmed', 'shop_accepted', 'order_packed', 'out_for_delivery', 'delivered', 'rejected']
const STATUS_LABEL: Record<string, string> = {
  all: 'All', payment_confirmed: 'New', shop_accepted: 'Accepted',
  order_packed: 'Packed', out_for_delivery: 'Delivering', delivered: 'Done', rejected: 'Rejected'
}

export default function ShopkeeperOrders() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [tab, setTab] = useState('all')
  const [shopId, setShopId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) return
      setShopId(shop.id)
      const { data } = await supabase.from('orders').select('*').eq('shop_id', shop.id).order('created_at', { ascending: false })
      setOrders(data || [])
    }
    load()
  }, [])

  const filtered = tab === 'all' ? orders : orders.filter(o => o.status === tab)

  async function markPacked(orderId: string) {
    await supabase.from('orders').update({ status: 'order_packed', packed_at: new Date().toISOString() }).eq('id', orderId)
    await supabase.from('order_status_history').insert({ order_id: orderId, status: 'order_packed' })
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'order_packed' } : o))
  }

  return (
    <div className="fade-in">
      <h2 style={{ marginBottom: 20 }}>📦 All Orders</h2>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {STATUS_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? 'active' : ''}`} style={{ flex: 'none' }}>
            {STATUS_LABEL[t]}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 40 }}>No orders in this category</div>}
        {filtered.map(order => (
          <div key={order.id} className="card">
            <div className="flex-between" style={{ marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{order.order_number}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{new Date(order.created_at).toLocaleString('en-IN')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color: 'var(--primary)' }}>₹{order.total_amount}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--success)' }}>Earn: ₹{order.shopkeeper_earning}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/shopkeeper/orders/${order.id}`)}>View Details</button>
              {order.status === 'shop_accepted' && (
                <button className="btn btn-primary btn-sm" onClick={() => markPacked(order.id)}>📦 Mark Packed</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
