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
  const [stats, setStats] = useState({ pendingShops: 0 })

  async function load() {
    setLoading(true)
    const shopsCount = await supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_approved', false)
    let q = supabase.from('shops').select('*').order('created_at', { ascending: false })
    if (tab === 'pending') q = q.eq('is_approved', false)
    else if (tab === 'active') q = q.eq('is_approved', true).eq('is_active', true)
    const { data } = await q
    setShops(data || [])
    setStats({ pendingShops: shopsCount.count || 0 })
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

      <div style={{ padding: '0 4px' }}>
      <h2 style={{ marginBottom: 16, fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>🏪 Shops</h2>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {(['pending', 'active', 'all'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ 
            flex: '0 0 auto', padding: '10px 18px', borderRadius: 20, border: '1.5px solid', 
            background: tab === t ? '#f97316' : 'white', borderColor: tab === t ? '#f97316' : '#e2e8f0',
            color: tab === t ? 'white' : '#64748b', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'pending' && stats.pendingShops > 0 && <span style={{ background: 'white', color: '#f97316', padding: '2px 6px', borderRadius: 10, marginLeft: 4 }}>{stats.pendingShops}</span>}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shops.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, background: '#f8fafc', borderRadius: 12 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏪</div>
              <p style={{ color: '#64748b' }}>No shops found</p>
            </div>
          )}
          {shops.map(shop => (
            <div key={shop.id} style={{ background: 'white', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: 14 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                {shop.shop_image_url ? (
                  <img src={shop.shop_image_url} alt="" style={{ width: 50, height: 50, borderRadius: 10, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 50, height: 50, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🏪</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{shop.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{shop.category} • {shop.city || 'N/A'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {!shop.is_approved ? (
                    <span style={{ background: '#fef3c7', color: '#d97706', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>Pending</span>
                  ) : shop.is_active ? (
                    <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>Active</span>
                  ) : (
                    <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>Inactive</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  👤 {shop.full_name || 'N/A'} • 📱 {shop.phone || 'N/A'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!shop.is_approved && (
                    <button onClick={() => setSelectedShop(shop)} style={{ background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Review</button>
                  )}
                  {shop.is_approved && (
                    <button onClick={() => toggleActive(shop)} style={{ background: shop.is_active ? '#fef3c7' : '#dcfce7', color: shop.is_active ? '#d97706' : '#16a34a', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      {shop.is_active ? '⏸️ Pause' : '▶️ Activate'}
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9', fontSize: '0.7rem', color: '#64748b' }}>
                <span>📦 {shop.total_orders || 0} orders</span>
                <span>⭐ {shop.rating > 0 ? shop.rating : 'N/A'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}