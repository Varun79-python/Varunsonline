'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Shop { id: string; name: string; category: string; city: string; phone: string; owner_id: string; is_approved: boolean; is_active: boolean; created_at: string; rating: number; total_orders: number }

export default function AdminShops() {
  const supabase = createClient()
  const [shops, setShops] = useState<Shop[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'all'>('pending')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    let q = supabase.from('shops').select('*').order('created_at', { ascending: false })
    if (tab === 'pending') q = q.eq('is_approved', false)
    else if (tab === 'active') q = q.eq('is_approved', true).eq('is_active', true)
    const { data } = await q
    setShops(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [tab])

  async function approve(shopId: string) {
    await supabase.from('shops').update({ is_approved: true, is_active: true }).eq('id', shopId)
    await supabase.from('notifications').insert({ user_id: shops.find(s => s.id === shopId)?.owner_id, title: '🎉 Shop Approved!', body: 'Your shop has been approved. Start selling now!', type: 'shop_approved' })
    setShops(prev => prev.filter(s => s.id !== shopId))
  }

  async function reject(shopId: string) {
    const reason = prompt('Rejection reason?')
    await supabase.from('shops').update({ is_approved: false, is_active: false, rejection_reason: reason }).eq('id', shopId)
    setShops(prev => prev.filter(s => s.id !== shopId))
  }

  async function toggleActive(shop: Shop) {
    await supabase.from('shops').update({ is_active: !shop.is_active }).eq('id', shop.id)
    setShops(prev => prev.map(s => s.id === shop.id ? { ...s, is_active: !s.is_active } : s))
  }

  return (
    <div className="fade-in">
      <h2 style={{ marginBottom: 20 }}>🏪 Shop Management</h2>
      <div className="tabs" style={{ marginBottom: 20, maxWidth: 400 }}>
        {(['pending', 'active', 'all'] as const).map(t => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
      </div>

      {loading ? <p>Loading...</p> : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Shop Name</th><th>Category</th><th>City</th><th>Phone</th><th>Orders</th><th>Rating</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {shops.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}>No shops in this category</td></tr>}
              {shops.map(shop => (
                <tr key={shop.id}>
                  <td style={{ fontWeight: 600 }}>{shop.name}</td>
                  <td><span className="badge badge-blue">{shop.category}</span></td>
                  <td>{shop.city}</td>
                  <td>{shop.phone}</td>
                  <td>{shop.total_orders}</td>
                  <td>{shop.rating > 0 ? `⭐ ${shop.rating}` : '—'}</td>
                  <td><span className={`badge ${shop.is_approved ? (shop.is_active ? 'badge-green' : 'badge-gray') : 'badge-yellow'}`}>{!shop.is_approved ? 'Pending' : shop.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!shop.is_approved && <><button className="btn btn-success btn-sm" onClick={() => approve(shop.id)}>✅ Approve</button><button className="btn btn-danger btn-sm" onClick={() => reject(shop.id)}>❌ Reject</button></>}
                      {shop.is_approved && <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(shop)}>{shop.is_active ? 'Deactivate' : 'Activate'}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
