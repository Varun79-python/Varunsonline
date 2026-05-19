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
      const { data: shop } = await supabase.from('shops').select('id, is_profile_complete').eq('owner_id', user.id).maybeSingle()
      if (!shop) { router.replace('/login/status'); return }
      if (!shop.is_profile_complete) { router.replace('/shopkeeper/complete-profile'); return }
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

  const getStatusColor = (status: string) => {
  const colors: Record<string, { bg: string; text: string }> = {
    payment_confirmed: { bg: '#fef3c7', text: '#d97706' },
    shop_accepted: { bg: '#dbeafe', text: '#2563eb' },
    order_packed: { bg: '#e0e7ff', text: '#4f46e5' },
    out_for_delivery: { bg: '#dcfce7', text: '#16a34a' },
    delivered: { bg: '#f0fdf4', text: '#16a34a' },
    rejected: { bg: '#fee2e2', text: '#dc2626' },
  }
  return colors[status] || { bg: '#f1f5f9', text: '#64748b' }
}

return (
    <div style={{ padding: '0 12px' }}>
      <h2 style={{ marginBottom: 16, fontSize: '1.2rem' }}>📦 Orders</h2>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, marginBottom: 8 }}>
        {STATUS_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ 
            flex: '0 0 auto', padding: '8px 14px', borderRadius: 20, border: '1.5px solid', 
            background: tab === t ? '#f97316' : 'white', borderColor: tab === t ? '#f97316' : '#e2e8f0',
            color: tab === t ? 'white' : '#64748b', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            {STATUS_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Order List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, background: '#f8fafc', borderRadius: 12 }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
            <p style={{ color: '#64748b', fontWeight: 600 }}>No orders found</p>
          </div>
        )}
        {filtered.map(order => {
          const statusStyle = getStatusColor(order.status)
          return (
            <div key={order.id} style={{ background: 'white', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{order.order_number}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{new Date(order.created_at).toLocaleString('en-IN')}</div>
                </div>
                <span style={{ background: statusStyle.bg, color: statusStyle.text, fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{STATUS_LABEL[order.status]}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800, color: '#f97316', fontSize: '1rem' }}>₹{order.shopkeeper_earning || order.total_amount}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => router.push(`/shopkeeper/orders/${order.id}`)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Details</button>
                  <button onClick={() => router.push(`/shopkeeper/orders/${order.id}`)} style={{ background: '#fff7ed', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, color: '#f97316', cursor: 'pointer' }}>💬 Chat</button>
                  {order.status === 'shop_accepted' && (
                    <button onClick={() => markPacked(order.id)} style={{ background: '#f97316', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, color: 'white', cursor: 'pointer' }}>📦 Pack</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
