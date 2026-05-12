'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Order {
  id: string
  order_number: string
  status: string
  total_amount: number
  created_at: string
  shop_id: string
  payment_method: string
  payment_status: string
  shops: { name: string; address_line1?: string; city?: string }
  order_items?: { product_name: string; quantity: number; product_image_url?: string }[]
}

interface OrderItem {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  product_image_url?: string
}

const STATUS_CONFIG: Record<string, { label: string; icon: string; bg: string; color: string; progressLabel: string }> = {
  placed: { label: 'Order Placed', icon: '📋', bg: '#f8fafc', color: '#64748b', progressLabel: 'Order Placed' },
  payment_pending: { label: 'Payment Pending', icon: '💳', bg: '#fef3c7', color: '#d97706', progressLabel: 'Awaiting Payment' },
  payment_confirmed: { label: 'Payment Confirmed', icon: '✅', bg: '#dcfce7', color: '#16a34a', progressLabel: 'Payment Confirmed' },
  shop_accepted: { label: 'Shop Accepted', icon: '🏪', bg: '#fef3c7', color: '#d97706', progressLabel: 'Preparing Order' },
  order_packed: { label: 'Order Packed', icon: '📦', bg: '#ffedd5', color: '#ea580c', progressLabel: 'Ready for Pickup' },
  agent_assigned: { label: 'Agent Assigned', icon: '🛵', bg: '#e0e7ff', color: '#4f46e5', progressLabel: 'Agent Assigned' },
  picked_up: { label: 'Picked Up', icon: '🏃', bg: '#e0e7ff', color: '#4f46e5', progressLabel: 'Picked Up' },
  out_for_delivery: { label: 'Out for Delivery', icon: '🚴', bg: '#dbeafe', color: '#2563eb', progressLabel: 'On the Way' },
  delivered: { label: 'Delivered', icon: '🎉', bg: '#dcfce7', color: '#16a34a', progressLabel: 'Delivered' },
  cancelled: { label: 'Cancelled', icon: '❌', bg: '#fee2e2', color: '#dc2626', progressLabel: 'Cancelled' },
  rejected: { label: 'Rejected', icon: '❌', bg: '#fee2e2', color: '#dc2626', progressLabel: 'Rejected' }
}

const PROGRESS_STEPS = [
  { status: 'payment_confirmed', label: 'Confirmed', icon: '✅' },
  { status: 'shop_accepted', label: 'Accepted', icon: '🏪' },
  { status: 'order_packed', label: 'Packed', icon: '📦' },
  { status: 'agent_assigned', label: 'Agent', icon: '🛵' },
  { status: 'out_for_delivery', label: 'Delivery', icon: '🚴' },
  { status: 'delivered', label: 'Delivered', icon: '🎉' },
]

const ACTIVE_STATUSES = ['placed', 'payment_pending', 'payment_confirmed', 'shop_accepted', 'order_packed', 'agent_assigned', 'picked_up', 'out_for_delivery']
const COMPLETED_STATUSES = ['delivered', 'cancelled', 'rejected']

export default function OrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [ratingModal, setRatingModal] = useState<{ orderId: string; shopName: string } | null>(null)
  const [shopRating, setShopRating] = useState(0)
  const [deliveryRating, setDeliveryRating] = useState(0)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratedOrders, setRatedOrders] = useState<Set<string>>(new Set())

  useEffect(() => {
    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) return

      const { data } = await supabase
        .from('orders')
        .select('*, shops(name, address_line1, city)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (!mounted) return

      if (data) {
        setOrders(data)
        const orderIds = data.map(o => o.id)
        const { data: items } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds)

        if (items && mounted) {
          const grouped: Record<string, OrderItem[]> = {}
          items.forEach(item => {
            if (!grouped[item.order_id]) grouped[item.order_id] = []
            grouped[item.order_id].push(item)
          })
          setOrderItems(grouped)
        }
      }
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

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.status))
  const completedOrders = orders.filter(o => COMPLETED_STATUSES.includes(o.status))

  function getCurrentStep(status: string) {
    const idx = PROGRESS_STEPS.findIndex(s => s.status === status)
    return idx >= 0 ? idx : 0
  }

  function formatDateTime(dateStr: string) {
    const date = new Date(dateStr)
    return {
      date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }
  }

  function getTotalItems(items: OrderItem[]) {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }

  async function submitRating() {
    if (!ratingModal || (shopRating === 0 && deliveryRating === 0)) return
    setRatingSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('order_ratings').insert({
        order_id: ratingModal.orderId,
        customer_id: user.id,
        shop_rating: shopRating || null,
        delivery_rating: deliveryRating || null,
      })
      setRatedOrders(prev => new Set([...prev, ratingModal.orderId]))
    }
    setShopRating(0)
    setDeliveryRating(0)
    setRatingModal(null)
    setRatingSubmitting(false)
  }

  function handleRateClick(e: React.MouseEvent, order: Order) {
    e.stopPropagation()
    if (ratedOrders.has(order.id)) return
    setRatingModal({ orderId: order.id, shopName: order.shops?.name || 'Shop' })
  }

  function handleReorderClick(e: React.MouseEvent, order: Order) {
    e.stopPropagation()
    router.push(`/customer/shop/${order.shop_id}`)
  }

  function StarIcon({ filled, half, onClick }: { filled: boolean; half?: boolean; onClick?: () => void }) {
    return (
      <span
        onClick={onClick}
        style={{
          fontSize: '1.5rem',
          cursor: onClick ? 'pointer' : 'default',
          color: filled || half ? '#f59e0b' : '#d1d5db',
          transition: 'transform 0.1s',
          transform: onClick ? 'scale(1.1)' : 'scale(1)',
          display: 'inline-block'
        }}
      >
        {filled ? '★' : half ? '★' : '☆'}
      </span>
    )
  }

  if (loading) return (
    <div style={{ padding: '60px 20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ padding: '0 0 100px', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ padding: '20px 16px 12px', background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>My Orders</h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0' }}>{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ width: 100, height: 100, borderRadius: 30, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <span style={{ fontSize: '3rem' }}>📦</span>
          </div>
          <h2 style={{ marginBottom: 8, fontSize: '1.2rem', color: '#0f172a' }}>No orders yet</h2>
          <p style={{ marginBottom: 24, fontSize: '0.9rem', color: '#64748b' }}>Place your first order from a nearby shop!</p>
          <button onClick={() => router.push('/customer')} style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: 'white', border: 'none', borderRadius: 12, padding: '14px 28px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}>
            Browse Shops
          </button>
        </div>
      ) : (
        <>
          {/* Active Orders Section */}
          {activeOrders.length > 0 && (
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Current Orders</span>
                <span style={{ background: '#f97316', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{activeOrders.length}</span>
              </div>

              {activeOrders.map(order => {
                const items = orderItems[order.id] || []
                const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.placed
                const currentStep = getCurrentStep(order.status)
                const { date, time } = formatDateTime(order.created_at)
                const totalItems = getTotalItems(items)

                return (
                  <div
                    key={order.id}
                    onClick={() => router.push(`/customer/orders/${order.id}`)}
                    style={{
                      background: 'white',
                      borderRadius: 20,
                      marginBottom: 16,
                      overflow: 'hidden',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                      border: '1px solid #f1f5f9',
                      cursor: 'pointer'
                    }}
                  >
                    {/* Shop Header */}
                    <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ width: 50, height: 50, borderRadius: 14, background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '1.5rem' }}>🏪</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{order.shops?.name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>{order.shops?.city || 'Local Delivery'}</div>
                      </div>
                      <div style={{ background: statusConfig.bg, padding: '6px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: '0.75rem' }}>{statusConfig.icon}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: statusConfig.color }}>{statusConfig.label}</span>
                      </div>
                    </div>

                    {/* Progress Tracker */}
                    <div style={{ padding: '16px', background: '#fafbfc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 10, left: 20, right: 20, height: 3, background: '#e2e8f0', borderRadius: 2 }}>
                          <div style={{ width: `${(currentStep / (PROGRESS_STEPS.length - 1)) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #f97316, #ea580c)', borderRadius: 2, transition: 'width 0.3s ease' }} />
                        </div>
                        {PROGRESS_STEPS.map((step, idx) => {
                          const isCompleted = idx <= currentStep
                          const isCurrent = idx === currentStep
                          return (
                            <div key={step.status} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                              <div style={{
                                width: 20, height: 20, borderRadius: '50%',
                                background: isCompleted ? '#f97316' : '#e2e8f0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: isCurrent ? '0 0 0 4px rgba(249,115,22,0.2)' : 'none',
                                transition: 'all 0.2s'
                              }}>
                                {isCompleted ? <span style={{ fontSize: '0.6rem' }}>✓</span> : null}
                              </div>
                              <span style={{ fontSize: '0.55rem', color: isCompleted ? '#f97316' : '#94a3b8', fontWeight: isCompleted ? 600 : 400, marginTop: 4, textAlign: 'center', maxWidth: 40 }}>{step.label}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Order Details */}
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Items: </span>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.75rem', background: order.payment_method === 'cod' ? '#fef3c7' : '#dcfce7', color: order.payment_method === 'cod' ? '#d97706' : '#16a34a', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                            {order.payment_method === 'cod' ? '💵 COD' : '💳 Online'}
                          </span>
                          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#f97316' }}>₹{order.total_amount}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{date} · {time}</span>
                        <button style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                          Track Order →
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Completed Orders Section */}
          {completedOrders.length > 0 && (
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Past Orders</span>
              </div>

              {completedOrders.map(order => {
                const items = orderItems[order.id] || []
                const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.delivered
                const { date, time } = formatDateTime(order.created_at)
                const totalItems = getTotalItems(items)
                const isDelivered = order.status === 'delivered'

                return (
                  <div
                    key={order.id}
                    onClick={() => router.push(`/customer/orders/${order.id}`)}
                    style={{
                      background: 'white',
                      borderRadius: 16,
                      marginBottom: 12,
                      overflow: 'hidden',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                      border: '1px solid #f1f5f9',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: isDelivered ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '1.3rem' }}>{isDelivered ? '✅' : '❌'}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{order.shops?.name}</div>
                          <div style={{ background: statusConfig.bg, padding: '4px 10px', borderRadius: 12 }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: statusConfig.color }}>{statusConfig.label}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                          {totalItems} item{totalItems !== 1 ? 's' : ''} · ₹{order.total_amount} · {order.payment_method === 'cod' ? 'COD' : 'Online'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>{date} · {time}</div>
                      </div>
                    </div>

                    {isDelivered && (
                      <div style={{ padding: '0 14px 14px', display: 'flex', gap: 8 }}>
                        <button
                          onClick={(e) => handleRateClick(e, order)}
                          disabled={ratedOrders.has(order.id)}
                          style={{ flex: 1, background: ratedOrders.has(order.id) ? '#dcfce7' : '#f1f5f9', border: '1px solid', borderColor: ratedOrders.has(order.id) ? '#86efac' : '#e2e8f0', color: ratedOrders.has(order.id) ? '#16a34a' : '#475569', padding: '10px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600, cursor: ratedOrders.has(order.id) ? 'default' : 'pointer' }}
                        >
                          {ratedOrders.has(order.id) ? '✓ Rated' : '⭐ Rate Order'}
                        </button>
                        <button onClick={(e) => handleReorderClick(e, order)} style={{ flex: 1, background: 'white', border: '1px solid #f97316', color: '#f97316', padding: '10px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                          🔁 Reorder
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {ratingModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(4px)'
        }} onClick={() => setRatingModal(null)}>
          <div style={{
            background: 'white', borderRadius: 24, padding: 24, width: '90%', maxWidth: 360,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>⭐</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Rate Your Order</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>{ratingModal.shopName}</p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 10 }}>Shop/Food Rating</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <span
                    key={star}
                    onClick={() => setShopRating(star)}
                    style={{
                      fontSize: '2rem', cursor: 'pointer', color: star <= shopRating ? '#f59e0b' : '#d1d5db',
                      transition: 'transform 0.1s'
                    }}
                  >
                    {star <= shopRating ? '★' : '☆'}
                  </span>
                ))}
              </div>
              {shopRating > 0 && (
                <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>
                  {shopRating === 5 ? 'Excellent!' : shopRating === 4 ? 'Great!' : shopRating === 3 ? 'Good' : shopRating === 2 ? 'Fair' : 'Poor'}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 10 }}>Delivery Rating</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <span
                    key={star}
                    onClick={() => setDeliveryRating(star)}
                    style={{
                      fontSize: '2rem', cursor: 'pointer', color: star <= deliveryRating ? '#f59e0b' : '#d1d5db',
                      transition: 'transform 0.1s'
                    }}
                  >
                    {star <= deliveryRating ? '★' : '☆'}
                  </span>
                ))}
              </div>
              {deliveryRating > 0 && (
                <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>
                  {deliveryRating === 5 ? 'Excellent!' : deliveryRating === 4 ? 'Great!' : deliveryRating === 3 ? 'Good' : deliveryRating === 2 ? 'Fair' : 'Poor'}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRatingModal(null)} style={{ flex: 1, background: '#f1f5f9', border: 'none', color: '#475569', padding: '14px', borderRadius: 12, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={submitRating}
                disabled={ratingSubmitting || (shopRating === 0 && deliveryRating === 0)}
                style={{ flex: 1, background: (shopRating === 0 && deliveryRating === 0) ? '#94a3b8' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', border: 'none', color: 'white', padding: '14px', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: (shopRating === 0 && deliveryRating === 0) ? 'not-allowed' : 'pointer' }}
              >
                {ratingSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}