'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Order {
  id: string; order_number: string; status: string; total_amount: number
  created_at: string; shopkeeper_earning: number
}

interface OrderItem {
  id: string; order_id: string; product_name: string; quantity: number
  unit_price: number; total_price: number; product_image_url?: string
}

interface PackingState {
  orderId: string
  items: { id: string; name: string; checked: boolean }[]
}

const STATUS_TABS = ['all', 'placed', 'payment_confirmed', 'shop_accepted', 'order_packed', 'out_for_delivery', 'delivered', 'rejected']
const STATUS_LABEL: Record<string, string> = {
  all: 'All', placed: 'COD New', payment_confirmed: 'New', shop_accepted: 'Accepted',
  order_packed: 'Packed', out_for_delivery: 'Delivering', delivered: 'Done', rejected: 'Rejected'
}

export default function ShopkeeperOrders() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState('all')
  const [shopId, setShopId] = useState<string | null>(null)
  const [packing, setPacking] = useState<PackingState | null>(null)
  const [packingItems, setPackingItems] = useState<OrderItem[]>([])
  const [packingLoading, setPackingLoading] = useState(false)
  const [packError, setPackError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        const { data: shop, error: shopErr } = await supabase.from('shops').select('id, is_approved, is_active').eq('owner_id', user.id).maybeSingle()
        if (shopErr) { setError(shopErr.message); setLoading(false); return }
        if (!shop || !shop.is_approved || !shop.is_active) { router.replace('/login/status'); return }
        setShopId(shop.id)
        const { data, error: ordersErr } = await supabase
          .from('orders')
          .select('id, order_number, status, total_amount, shopkeeper_earning, created_at')
          .eq('shop_id', shop.id)
          .order('created_at', { ascending: false })
        if (ordersErr) { setError(ordersErr.message); setLoading(false); return }
        setOrders(data || [])
      } catch (err) {
        console.error('[shopkeeper-orders] load error:', err)
        setError('Failed to load orders')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = tab === 'all' ? orders : orders.filter(o => o.status === tab)

  async function openPackingChecklist(orderId: string) {
    try {
      setPackingLoading(true)
      const { data: items, error: itemsErr } = await supabase
        .from('order_items')
        .select('id, product_name, quantity, unit_price, total_price, product_image_url')
        .eq('order_id', orderId)
      if (itemsErr) { setPackError(itemsErr.message); return }
      if (items) {
        setPackingItems(items)
        setPacking({
          orderId,
          items: items.map((i: OrderItem) => ({ id: i.id, name: i.product_name, checked: false }))
        })
      }
    } catch (err) {
      console.error('[shopkeeper-orders] openPackingChecklist error:', err)
      setPackError('Failed to load order items')
    } finally {
      setPackingLoading(false)
    }
  }

  function toggleCheck(itemId: string) {
    if (!packing) return
    setPackError(null)
    setPacking({
      ...packing,
      items: packing.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i)
    })
  }

  async function confirmPacked() {
    if (!packing) return
    const { orderId } = packing
    const allChecked = packing.items.every(i => i.checked)
    if (!allChecked) return

    try {
      setPackError(null)
      const { error: updateErr } = await supabase
        .from('orders')
        .update({ status: 'order_packed', packed_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('status', 'shop_accepted') // atomic guard: only update if still in correct state
      if (updateErr) { setPackError(updateErr.message); return }
      if (!updateErr) { // ensure at least one row was updated
        const { error: histErr } = await supabase
          .from('order_status_history')
          .insert({ order_id: orderId, status: 'order_packed' })
        if (histErr) console.error('[shopkeeper-orders] history insert error:', histErr)
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'order_packed' } : o))
      setPacking(null)
    } catch (err) {
      console.error('[shopkeeper-orders] confirmPacked error:', err)
      setPackError('Failed to mark as packed')
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      placed: { bg: '#dbeafe', text: '#2563eb' },
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

      {/* Packing Checklist Modal */}
      {packing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => setPacking(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, maxHeight: '80vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, fontSize: '1.05rem' }}>📦 Packing Checklist</h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 16 }}>
              Check each item as you pack it to ensure nothing is missed.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {packing.items.map(item => (
                <label key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 10,
                  background: item.checked ? '#f0fdf4' : '#f8fafc',
                  border: `1.5px solid ${item.checked ? '#bbf7d0' : '#e2e8f0'}`,
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleCheck(item.id)}
                    style={{ width: 20, height: 20, accentColor: '#16a34a', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1, textDecoration: item.checked ? 'line-through' : 'none', color: item.checked ? '#16a34a' : '#1e293b' }}>
                    {item.name}
                  </span>
                  {item.checked && <span style={{ color: '#16a34a' }}>✓</span>}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPacking(null)}
                style={{ flex: 1, padding: 12, background: '#f1f5f9', border: 'none', borderRadius: 10, fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmPacked} disabled={!packing.items.every(i => i.checked)}
                style={{
                  flex: 1, padding: 12, borderRadius: 10, fontWeight: 700, border: 'none',
                  background: packing.items.every(i => i.checked) ? '#f97316' : '#e2e8f0',
                  color: packing.items.every(i => i.checked) ? 'white' : '#94a3b8',
                  cursor: packing.items.every(i => i.checked) ? 'pointer' : 'not-allowed'
                }}>
                📦 Mark Packed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ background: '#f1f5f9', borderRadius: 12, height: 100, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 12, textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>⚠️</div>
          <p style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.85rem' }}>{error}</p>
        </div>
      )}

      {packError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
          ❌ {packError}
        </div>
      )}

      {/* Order List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!loading && filtered.length === 0 && (
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
                <div style={{ fontWeight: 800, color: '#f97316', fontSize: '1rem' }}>₹{order.shopkeeper_earning ?? order.total_amount}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => router.push(`/shopkeeper/orders/${order.id}`)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Details</button>
                  <button onClick={() => router.push(`/shopkeeper/orders/${order.id}`)} style={{ background: '#fff7ed', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, color: '#f97316', cursor: 'pointer' }}>💬 Chat</button>
                  {order.status === 'shop_accepted' && (
                    <button onClick={() => openPackingChecklist(order.id)} style={{ background: '#f97316', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, color: 'white', cursor: 'pointer' }}>
                      📦 Pack
                    </button>
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
