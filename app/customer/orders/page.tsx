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
  payment_confirmed: '✅ Confirmed', shop_accepted: '🏪 Accepted',
  order_packed: '📦 Packed', agent_assigned: '🛵 Agent Assigned',
  picked_up: '🏃 Picked Up', out_for_delivery: '🚴 Out for Delivery',
  delivered: '✅ Delivered', cancelled: '❌ Cancelled', rejected: '❌ Rejected'
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  delivered:         { bg: '#f0fdf4', color: '#16a34a' },
  cancelled:         { bg: '#fef2f2', color: '#dc2626' },
  rejected:          { bg: '#fef2f2', color: '#dc2626' },
  out_for_delivery:  { bg: '#eff6ff', color: '#2563eb' },
  order_packed:      { bg: '#fff7ed', color: '#ea580c' },
  shop_accepted:     { bg: '#fff7ed', color: '#ea580c' },
  placed:            { bg: '#f8fafc', color: '#475569' },
}
const STATUS_DEFAULT = { bg: '#f8fafc', color: '#64748b' }

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

      if (!mounted) return
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

  if (loading) return (
    <div style={{ padding: '60px 20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (orders.length === 0) return (
    <div style={{ textAlign: 'center', padding: '70px 24px' }}>
      <div style={{ fontSize: '3.5rem', marginBottom: 14 }}>📦</div>
      <h2 style={{ marginBottom: 8, fontSize: '1.15rem' }}>No orders yet</h2>
      <p style={{ marginBottom: 22, fontSize: '0.88rem', color: '#64748b' }}>Place your first order from a nearby shop!</p>
      <button className="btn btn-primary" onClick={() => router.push('/customer')}>Browse Shops</button>
    </div>
  )

  return (
    <div className="fade-in ord-root">
      <div className="ord-header">
        <h2 className="ord-title">My Orders</h2>
        <span className="ord-count">{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="ord-list">
        {orders.map(order => {
          const sc = STATUS_COLOR[order.status] || STATUS_DEFAULT
          const date = new Date(order.created_at)
          const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
          const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

          return (
            <div
              key={order.id}
              className="ord-card"
              onClick={() => router.push(`/customer/orders/${order.id}`)}
            >
              {/* Left: order info */}
              <div className="ord-card-left">
                <div className="ord-num">{order.order_number}</div>
                <div className="ord-shop">{order.shops?.name}</div>
                <div className="ord-date">{dateStr} · {timeStr}</div>
              </div>
              {/* Right: amount + status */}
              <div className="ord-card-right">
                <div className="ord-amount">₹{order.total_amount}</div>
                <span
                  className="ord-status-badge"
                  style={{ background: sc.bg, color: sc.color }}
                >
                  {STATUS_LABEL[order.status] || order.status}
                </span>
              </div>
              {/* Chevron */}
              <div className="ord-chevron">›</div>
            </div>
          )
        })}
      </div>

      <style>{`
        .ord-root { padding: 0; }

        .ord-header {
          display: flex; align-items: baseline;
          justify-content: space-between;
          padding: 16px 16px 10px;
        }
        .ord-title { font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0; }
        .ord-count { font-size: 0.78rem; color: #94a3b8; }

        .ord-list {
          display: flex; flex-direction: column;
          gap: 1px;
          background: #f1f5f9;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }

        .ord-card {
          background: white;
          display: flex; align-items: center;
          padding: 14px 16px;
          cursor: pointer;
          gap: 12px;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: background 0.1s;
        }
        .ord-card:active { background: #f8fafc; }

        .ord-card-left { flex: 1; min-width: 0; }
        .ord-num  { font-weight: 700; font-size: 0.9rem; color: #0f172a; margin-bottom: 2px; }
        .ord-shop { font-size: 0.78rem; color: #64748b; margin-bottom: 3px;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ord-date { font-size: 0.72rem; color: #94a3b8; }

        .ord-card-right {
          flex-shrink: 0;
          display: flex; flex-direction: column; align-items: flex-end; gap: 5px;
        }
        .ord-amount { font-weight: 800; font-size: 0.95rem; color: #f97316; }
        .ord-status-badge {
          font-size: 0.65rem; font-weight: 700;
          padding: 3px 8px; border-radius: 99px;
          white-space: nowrap;
        }
        .ord-chevron {
          font-size: 1.3rem; color: #cbd5e1;
          flex-shrink: 0; margin-left: -4px;
          line-height: 1;
        }

        @media (min-width: 640px) {
          .ord-list {
            gap: 8px;
            background: transparent;
            border: none;
            padding: 0 16px;
          }
          .ord-card {
            border-radius: 14px;
            border: 1.5px solid #e2e8f0;
            box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          }
        }
      `}</style>
    </div>
  )
}
