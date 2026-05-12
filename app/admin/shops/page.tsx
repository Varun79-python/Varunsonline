'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Shop {
  id: string
  name: string
  full_name: string
  email: string
  category: string
  city: string
  phone: string
  owner_id: string
  is_approved: boolean
  is_active: boolean
  shop_image_url: string
  terms_accepted: boolean
  rejection_reason: string | null
  created_at: string
  rating: number
  total_orders: number
}

export default function AdminShops() {
  const supabase = createClient()
  const [shops, setShops] = useState<Shop[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [rejectReason, setRejectReason] = useState('')

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
    const shop = shops.find(s => s.id === shopId)
    if (shop?.owner_id) {
      await supabase.from('notifications').insert({ 
        user_id: shop.owner_id, 
        title: '🎉 Shop Approved!', 
        body: 'Your shop has been approved. Start selling now!', 
        type: 'shop_approved' 
      })
    }
    setShops(prev => prev.filter(s => s.id !== shopId))
    setSelectedShop(null)
  }

  async function rejectShop() {
    if (!selectedShop) return
    await supabase.from('shops').update({ 
      is_approved: false, 
      is_active: false, 
      rejection_reason: rejectReason || 'Your shop registration was rejected by admin.'
    }).eq('id', selectedShop.id)
    
    if (selectedShop.owner_id) {
      await supabase.from('notifications').insert({ 
        user_id: selectedShop.owner_id, 
        title: '❌ Shop Registration Rejected', 
        body: rejectReason || 'Your shop registration was rejected by admin.', 
        type: 'shop_rejected' 
      })
    }
    
    setShops(prev => prev.filter(s => s.id !== selectedShop.id))
    setSelectedShop(null)
    setRejectReason('')
  }

  async function toggleActive(shop: Shop) {
    await supabase.from('shops').update({ is_active: !shop.is_active }).eq('id', shop.id)
    setShops(prev => prev.map(s => s.id === shop.id ? { ...s, is_active: !s.is_active } : s))
  }

  return (
    <div className="fade-in">
      {selectedShop && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: 16, fontSize: '1.25rem', fontWeight: 700 }}>📋 Shop Registration Details</h3>
            
            {selectedShop.shop_image_url && (
              <div style={{ marginBottom: 16 }}>
                <img src={selectedShop.shop_image_url} alt="Shop" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 12 }} />
              </div>
            )}
            
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Full Name</div>
                <div style={{ fontWeight: 600 }}>{selectedShop.full_name || '—'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Phone Number</div>
                <div style={{ fontWeight: 600 }}>{selectedShop.phone || '—'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Email ID</div>
                <div style={{ fontWeight: 600 }}>{selectedShop.email || '—'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Shop Name</div>
                <div style={{ fontWeight: 600 }}>{selectedShop.name || '—'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Registration Date</div>
                <div style={{ fontWeight: 600 }}>{new Date(selectedShop.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div style={{ background: selectedShop.terms_accepted ? '#f0fdf4' : '#fef2f2', padding: 12, borderRadius: 8, border: `1px solid ${selectedShop.terms_accepted ? '#bbf7d0' : '#fecaca'}` }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Terms Accepted</div>
                <div style={{ fontWeight: 600, color: selectedShop.terms_accepted ? '#16a34a' : '#dc2626' }}>{selectedShop.terms_accepted ? '✅ Yes' : '❌ No'}</div>
              </div>
              <div style={{ background: '#fefce8', padding: 12, borderRadius: 8, border: '1px solid #fef08a' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Approval Status</div>
                <div style={{ fontWeight: 600, color: '#ca8a04' }}>⏳ Pending Review</div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={() => approve(selectedShop.id)} style={{ padding: 14, background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                ✅ Approve Shop
              </button>
              <div>
                <textarea 
                  placeholder="Rejection reason (optional)" 
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', minHeight: 80, boxSizing: 'border-box', marginBottom: 10 }}
                />
                <button onClick={rejectShop} disabled={!rejectReason && !confirm('Are you sure you want to reject this shop without a reason?')} style={{ width: '100%', padding: 14, background: '#dc2626', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                  ❌ Reject Shop
                </button>
              </div>
              <button onClick={() => { setSelectedShop(null); setRejectReason('') }} style={{ padding: 12, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ marginBottom: 20 }}>🏪 Shop Management</h2>
      <div className="tabs" style={{ marginBottom: 20, maxWidth: 400 }}>
        {(['pending', 'active', 'all'] as const).map(t => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
      </div>

      {loading ? <p>Loading...</p> : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Shop</th>
                <th>Owner</th>
                <th>Contact</th>
                <th>City</th>
                <th>Orders</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shops.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}>No shops in this category</td></tr>}
              {shops.map(shop => (
                <tr key={shop.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {shop.shop_image_url && <img src={shop.shop_image_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />}
                      <div>
                        <div style={{ fontWeight: 600 }}>{shop.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{shop.category}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{shop.full_name || '—'}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{shop.email || '—'}</div>
                  </td>
                  <td>{shop.phone || '—'}</td>
                  <td>{shop.city || '—'}</td>
                  <td>{shop.total_orders}</td>
                  <td>{shop.rating > 0 ? `⭐ ${shop.rating}` : '—'}</td>
                  <td>
                    {!shop.is_approved ? (
                      <span className="badge badge-yellow">Pending</span>
                    ) : shop.is_active ? (
                      <span className="badge badge-green">Active</span>
                    ) : (
                      <span className="badge badge-gray">Inactive</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {!shop.is_approved && (
                        <button className="btn btn-primary btn-sm" onClick={() => setSelectedShop(shop)}>
                          👁️ View
                        </button>
                      )}
                      {shop.is_approved && (
                        <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(shop)}>
                          {shop.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
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