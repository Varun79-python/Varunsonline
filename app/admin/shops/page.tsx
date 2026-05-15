'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UnifiedShop {
  id: string // shop.id or shop_documents.id
  type: 'document' | 'shop'
  user_id: string
  name: string
  full_name: string
  phone: string
  email: string
  category: string
  city: string
  is_approved: boolean
  is_active: boolean
  image_url: string
  rejection_reason: string | null
  created_at: string
  rating: number
  total_orders: number
  // Document specific
  aadhar_url?: string
}

export default function AdminShops() {
  const supabase = createClient()
  const [items, setItems] = useState<UnifiedShop[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<UnifiedShop | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [stats, setStats] = useState({ pendingDocs: 0 })
  const [processing, setProcessing] = useState(false)
  
  const loadingRef = useRef(false)
  const mountedRef = useRef(false)

  useEffect(() => { mountedRef.current = true }, [])

  async function load() {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    
    try {
      const { count } = await supabase.from('shop_documents').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      
      let fetchedItems: UnifiedShop[] = []

      if (tab === 'pending') {
        const { data: docs } = await supabase
          .from('shop_documents')
          .select('id, user_id, status, shop_photo_url, aadhar_url, created_at, profiles(full_name, phone)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          
        fetchedItems = (docs || []).map((doc: any) => ({
          id: doc.id,
          type: 'document',
          user_id: doc.user_id,
          name: 'Pending Registration',
          full_name: doc.profiles?.full_name || 'Unknown',
          phone: doc.profiles?.phone || 'Unknown',
          email: '',
          category: 'N/A',
          city: 'N/A',
          is_approved: false,
          is_active: false,
          image_url: doc.shop_photo_url,
          aadhar_url: doc.aadhar_url,
          rejection_reason: null,
          created_at: doc.created_at,
          rating: 0,
          total_orders: 0
        }))
      } else if (tab === 'active' || tab === 'rejected' || tab === 'all') {
        let q = supabase.from('shops').select('*').order('created_at', { ascending: false })
        if (tab === 'active') q = q.eq('is_approved', true).eq('is_active', true)
        if (tab === 'rejected') q = q.eq('is_approved', false).not('rejection_reason', 'is', null)
        
        const { data: shops } = await q
        
        // Fetch rejected docs
        let rejectedDocs: any[] = []
        if (tab === 'rejected' || tab === 'all') {
          const { data: rDocs } = await supabase.from('shop_documents')
            .select('id, user_id, status, shop_photo_url, aadhar_url, created_at, profiles(full_name, phone)')
            .eq('status', 'rejected')
          rejectedDocs = rDocs || []
        }

        // Fetch approved docs (that haven't created a shop yet)
        let approvedDocs: any[] = []
        if (tab === 'active' || tab === 'all') {
          const { data: aDocs } = await supabase.from('shop_documents')
            .select('id, user_id, status, shop_photo_url, aadhar_url, created_at, profiles(full_name, phone)')
            .eq('status', 'approved')
          
          // Filter out those who already have a shop
          const shopOwnerIds = new Set((shops || []).map((s: any) => s.owner_id))
          approvedDocs = (aDocs || []).filter((d: any) => !shopOwnerIds.has(d.user_id))
        }

        const mappedShops = (shops || []).map((shop: any) => ({
          id: shop.id,
          type: 'shop',
          user_id: shop.owner_id,
          name: shop.name,
          full_name: shop.full_name || 'Unknown',
          phone: shop.phone || 'Unknown',
          email: shop.email || '',
          category: shop.category || 'N/A',
          city: shop.city || 'N/A',
          is_approved: shop.is_approved,
          is_active: shop.is_active,
          image_url: shop.shop_image_url,
          rejection_reason: shop.rejection_reason,
          created_at: shop.created_at,
          rating: shop.rating || 0,
          total_orders: shop.total_orders || 0
        }))
        
        const mappedRejectedDocs = rejectedDocs.map((doc: any) => ({
          id: doc.id,
          type: 'document',
          user_id: doc.user_id,
          name: 'Rejected Registration',
          full_name: doc.profiles?.full_name || 'Unknown',
          phone: doc.profiles?.phone || 'Unknown',
          email: '',
          category: 'N/A',
          city: 'N/A',
          is_approved: false,
          is_active: false,
          image_url: doc.shop_photo_url,
          aadhar_url: doc.aadhar_url,
          rejection_reason: 'Documents rejected',
          created_at: doc.created_at,
          rating: 0,
          total_orders: 0
        }))

        const mappedApprovedDocs = approvedDocs.map((doc: any) => ({
          id: doc.id,
          type: 'document',
          user_id: doc.user_id,
          name: 'Approved (Pending Shop Creation)',
          full_name: doc.profiles?.full_name || 'Unknown',
          phone: doc.profiles?.phone || 'Unknown',
          email: '',
          category: 'N/A',
          city: 'N/A',
          is_approved: true,
          is_active: true,
          image_url: doc.shop_photo_url,
          aadhar_url: doc.aadhar_url,
          rejection_reason: null,
          created_at: doc.created_at,
          rating: 0,
          total_orders: 0
        }))

        fetchedItems = [...mappedShops, ...mappedRejectedDocs, ...mappedApprovedDocs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      }
      
      if (mountedRef.current) {
        setItems(fetchedItems as UnifiedShop[])
        setStats({ pendingDocs: count || 0 })
      }
    } catch (err) {
      console.error('Failed to load shops:', err)
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        loadingRef.current = false
      }
    }
  }

  useEffect(() => { 
    if (!loadingRef.current) load() 
  }, [tab])

  function handleSelectShop(item: UnifiedShop) {
    setSelectedItem(item)
    setRejectReason('')
  }

  async function approve(item: UnifiedShop) {
    setProcessing(true)
    if (item.type === 'document') {
      await supabase.from('shop_documents').update({ status: 'approved' }).eq('id', item.id)
      await supabase.from('notifications').insert({ 
        user_id: item.user_id, 
        title: '🎉 Documents Approved!', 
        body: 'Your documents have been approved. You can now access your dashboard and set up your shop!', 
        type: 'shop_approved' 
      })
    } else {
      await supabase.from('shops').update({ is_approved: true, is_active: true, rejection_reason: null }).eq('id', item.id)
      await supabase.from('notifications').insert({ 
        user_id: item.user_id, 
        title: '🎉 Shop Approved!', 
        body: 'Your shop has been approved. Start selling now!', 
        type: 'shop_approved' 
      })
    }
    setItems(prev => prev.filter(s => s.id !== item.id))
    setSelectedItem(null)
    setProcessing(false)
    load()
  }

  async function rejectItem() {
    if (!selectedItem) return
    setProcessing(true)
    const reason = rejectReason || 'Your registration was rejected by admin.'
    
    if (selectedItem.type === 'document') {
      await supabase.from('shop_documents').update({ status: 'rejected' }).eq('id', selectedItem.id)
    } else {
      await supabase.from('shops').update({ 
        is_approved: false, 
        is_active: false, 
        rejection_reason: reason
      }).eq('id', selectedItem.id)
    }
    
    await supabase.from('notifications').insert({ 
      user_id: selectedItem.user_id, 
      title: '❌ Registration Rejected', 
      body: reason, 
      type: 'shop_rejected' 
    })
    
    setItems(prev => prev.filter(s => s.id !== selectedItem.id))
    setSelectedItem(null)
    setRejectReason('')
    setProcessing(false)
    load()
  }

  async function toggleActive(item: UnifiedShop) {
    if (item.type === 'document') return
    await supabase.from('shops').update({ is_active: !item.is_active }).eq('id', item.id)
    setItems(prev => prev.map(s => s.id === item.id ? { ...s, is_active: !s.is_active } : s))
  }

  async function reapproveShop(item: UnifiedShop) {
    if (!confirm(`Re-approve ${item.name}?`)) return
    setProcessing(true)
    if (item.type === 'document') {
      await supabase.from('shop_documents').update({ status: 'approved' }).eq('id', item.id)
    } else {
      await supabase.from('shops').update({ 
        is_approved: true, 
        is_active: true,
        rejection_reason: null 
      }).eq('id', item.id)
    }
    
    await supabase.from('notifications').insert({ 
      user_id: item.user_id, 
      title: '🎉 Registration Re-approved!', 
      body: 'Your registration has been re-approved!', 
      type: 'shop_approved' 
    })
    
    setProcessing(false)
    load()
    setSelectedItem(null)
  }

  async function deleteShopPermanently(item: UnifiedShop) {
    if (!confirm(`⚠️ PERMANENTLY DELETE ${item.name}? This cannot be undone!`)) return
    
    setProcessing(true)
    try {
      if (item.type === 'document') {
        // Delete documents
        await supabase.from('shop_documents').delete().eq('id', item.id)
      } else {
        await supabase.from('shops').delete().eq('id', item.id)
      }
      
      alert(`✅ Deleted successfully.`)
      setSelectedItem(null)
      load()
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{ padding: '0 4px' }}>
      {selectedItem && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => { setSelectedItem(null); setRejectReason('') }}
        >
          <div 
            style={{ background: 'white', borderRadius: 16, padding: 0, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>📋 {selectedItem.type === 'document' ? 'Registration Details' : 'Shop Details'}</h3>
              <button 
                onClick={() => { setSelectedItem(null); setRejectReason('') }}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: '1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: 20 }}>
              {selectedItem.type === 'document' ? (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, color: '#0f172a' }}>📄 Uploaded Documents</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ background: '#f8fafc', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <div style={{ padding: '8px 12px', background: '#f1f5f9', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Shop Photo</div>
                      <div style={{ padding: 8 }}>
                        <img src={selectedItem.image_url} alt="Shop Photo" style={{ width: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 6, background: '#fff' }} />
                        <a href={selectedItem.image_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 8, fontSize: '0.8rem', color: '#0ea5e9', textDecoration: 'underline' }}>🔗 Open Full Image</a>
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <div style={{ padding: '8px 12px', background: '#f1f5f9', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Aadhaar Card</div>
                      <div style={{ padding: 8 }}>
                        <img src={selectedItem.aadhar_url} alt="Aadhaar" style={{ width: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 6, background: '#fff' }} />
                        <a href={selectedItem.aadhar_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 8, fontSize: '0.8rem', color: '#0ea5e9', textDecoration: 'underline' }}>🔗 Open Full Image</a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                selectedItem.image_url && (
                  <div style={{ marginBottom: 16 }}>
                    <img src={selectedItem.image_url} alt="Shop" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 12 }} />
                  </div>
                )
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Full Name</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedItem.full_name || '—'}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Phone</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedItem.phone || '—'}</div>
                </div>
                {selectedItem.type === 'shop' && (
                  <>
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Shop Name</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedItem.name || '—'}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Category</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedItem.category || '—'}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>City</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedItem.city || '—'}</div>
                    </div>
                  </>
                )}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Registration Date</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{new Date(selectedItem.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedItem.rejection_reason && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', marginBottom: 8, fontSize: '0.85rem', color: '#dc2626' }}>
                    ❌ Rejection Reason: <strong>{selectedItem.rejection_reason}</strong>
                  </div>
                )}
                
                {selectedItem.is_approved && !selectedItem.is_active && selectedItem.type === 'shop' && (
                  <button onClick={() => reapproveShop(selectedItem)} disabled={processing} style={{ padding: 14, background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer' }}>
                    ✅ Reapprove & Activate
                  </button>
                )}
                
                {selectedItem.rejection_reason && (
                  <button onClick={() => deleteShopPermanently(selectedItem)} disabled={processing} style={{ padding: 14, background: '#dc2626', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer' }}>
                    🗑️ Delete Permanently
                  </button>
                )}
                
                {!selectedItem.is_approved && !selectedItem.rejection_reason && (
                  <>
                    <button onClick={() => approve(selectedItem)} disabled={processing} style={{ padding: 14, background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                      ✅ Approve
                    </button>
                    <div>
                      <textarea placeholder="Rejection reason (optional)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', minHeight: 80, boxSizing: 'border-box', marginBottom: 10 }} />
                      <button onClick={rejectItem} disabled={processing} style={{ width: '100%', padding: 14, background: '#dc2626', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                        ❌ Reject
                      </button>
                    </div>
                  </>
                )}
                <button onClick={() => { setSelectedItem(null); setRejectReason('') }} style={{ padding: 12, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ marginBottom: 16, fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>🏪 Shops & Registrations</h2>
      
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {(['pending', 'active', 'rejected', 'all'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ 
            flex: '0 0 auto', padding: '10px 18px', borderRadius: 20, border: '1.5px solid', 
            background: tab === t ? '#f97316' : 'white', borderColor: tab === t ? '#f97316' : '#e2e8f0',
            color: tab === t ? 'white' : '#64748b', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'pending' && stats.pendingDocs > 0 && <span style={{ background: 'white', color: '#f97316', padding: '2px 6px', borderRadius: 10, marginLeft: 4 }}>{stats.pendingDocs}</span>}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, background: '#f8fafc', borderRadius: 12 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📋</div>
              <p style={{ color: '#64748b' }}>No records found</p>
            </div>
          )}
          {items.map(item => (
            <div key={item.id} style={{ background: 'white', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: 14 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                {item.image_url ? (
                  <img src={item.image_url} alt="" style={{ width: 50, height: 50, borderRadius: 10, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 50, height: 50, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📋</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{item.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.type === 'document' ? 'Registration' : `${item.category} • ${item.city || 'N/A'}`}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {!item.is_approved && !item.rejection_reason ? (
                    <span style={{ background: '#fef3c7', color: '#d97706', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>Pending</span>
                  ) : item.is_active || (item.type === 'document' && item.is_approved) ? (
                    <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>{item.type === 'document' ? 'Approved' : 'Active'}</span>
                  ) : (
                    <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>Inactive / Rejected</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  👤 {item.full_name || 'N/A'} • 📱 {item.phone || 'N/A'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!item.is_approved && !item.rejection_reason && (
                    <button onClick={() => handleSelectShop(item)} style={{ background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Review</button>
                  )}
                  {item.is_approved && item.type === 'shop' && (
                    <button onClick={() => toggleActive(item)} style={{ background: item.is_active ? '#fef3c7' : '#dcfce7', color: item.is_active ? '#d97706' : '#16a34a', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      {item.is_active ? '⏸️ Pause' : '▶️ Activate'}
                    </button>
                  )}
                  {item.is_approved && !item.is_active && item.type === 'shop' && (
                    <button onClick={() => reapproveShop(item)} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      ✅ Reapprove
                    </button>
                  )}
                  {item.rejection_reason && (
                    <button onClick={() => deleteShopPermanently(item)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}