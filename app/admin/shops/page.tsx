'use client'
import { useEffect, useState, useRef } from 'react'
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

interface ShopDocument {
  id: string
  user_id: string
  doc_type: string
  file_url: string
  file_name: string
}

export default function AdminShops() {
  const supabase = createClient()
  const [shops, setShops] = useState<Shop[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [shopDocs, setShopDocs] = useState<ShopDocument[]>([])
  const [rejectReason, setRejectReason] = useState('')
  const [stats, setStats] = useState({ pendingShops: 0 })
  const [processing, setProcessing] = useState(false)
  
  const loadingRef = useRef(false)
  const mountedRef = useRef(false)

  useEffect(() => { mountedRef.current = true }, [])

  async function load() {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    
    try {
      // Get all shops
      const { data: allShops } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false })
      
      // Get all documents
      const { data: allDocs } = await supabase
        .from('shop_documents')
        .select('*')
      
      // Create a map of user_id to documents
      const docsMap = new Map<string, ShopDocument[]>()
      allDocs?.forEach((doc: ShopDocument) => {
        const existing = docsMap.get(doc.user_id) || []
        existing.push(doc)
        docsMap.set(doc.user_id, existing)
      })

      // Calculate pending (shops with docs but not approved)
      const pendingShops = allShops?.filter(s => {
        const docs = docsMap.get(s.owner_id)
        return docs && docs.length > 0 && !s.is_approved && !s.rejection_reason
      }) || []

      let filteredShops = allShops || []
      
      if (tab === 'pending') {
        filteredShops = pendingShops
      } else if (tab === 'active') {
        filteredShops = allShops?.filter(s => s.is_approved && s.is_active) || []
      } else if (tab === 'rejected') {
        filteredShops = allShops?.filter(s => !s.is_approved && s.rejection_reason) || []
      }
      
      if (mountedRef.current) {
        setShops(filteredShops)
        setStats({ pendingShops: pendingShops.length })
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

  async function loadShopDocuments(shop: Shop) {
    // Load documents using user_id (owner_id)
    const { data } = await supabase
      .from('shop_documents')
      .select('*')
      .eq('user_id', shop.owner_id)
    setShopDocs(data || [])
  }

  function handleSelectShop(shop: Shop) {
    setSelectedShop(shop)
    setRejectReason('')
    loadShopDocuments(shop)
  }

  async function approve(shopId: string) {
    setProcessing(true)
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
    setShopDocs([])
    setProcessing(false)
  }

  async function rejectShop() {
    if (!selectedShop) return
    setProcessing(true)
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
    setShopDocs([])
    setRejectReason('')
    setProcessing(false)
  }

  async function toggleActive(shop: Shop) {
    await supabase.from('shops').update({ is_active: !shop.is_active }).eq('id', shop.id)
    setShops(prev => prev.map(s => s.id === shop.id ? { ...s, is_active: !s.is_active } : s))
  }

  async function reapproveShop(shop: Shop) {
    if (!confirm(`Re-approve ${shop.name}? They will be able to start selling again.`)) return
    setProcessing(true)
    await supabase.from('shops').update({ 
      is_approved: true, 
      is_active: true,
      rejection_reason: null 
    }).eq('id', shop.id)
    
    if (shop.owner_id) {
      await supabase.from('notifications').insert({ 
        user_id: shop.owner_id, 
        title: '🎉 Shop Re-approved!', 
        body: 'Your shop has been re-approved. Start selling now!', 
        type: 'shop_approved' 
      })
    }
    
    setProcessing(false)
    load()
    setSelectedShop(null)
  }

  async function deleteShopPermanently(shop: Shop) {
    if (!confirm(`⚠️ PERMANENTLY DELETE ${shop.name}? This will:\n\n• Delete all shop data\n• Delete uploaded documents\n• Allow them to register again\n\nThis cannot be undone!`)) return
    
    setProcessing(true)
    try {
      // Delete shop documents from storage
      const { data: docs } = await supabase.from('shop_documents').select('file_url').eq('user_id', shop.owner_id)
      if (docs) {
        for (const doc of docs) {
          if (doc.file_url) {
            try {
              const pathMatch = doc.file_url.match(/storage\.supabase\.co.*\/object\/(?:public\/)?[^/]+\/(.+)/i)
              if (pathMatch) {
                await supabase.storage.from('shop-documents').remove([pathMatch[1]])
              }
            } catch (e) { console.error('Delete file error:', e) }
          }
        }
      }
      
      // Delete shop documents from database
      await supabase.from('shop_documents').delete().eq('user_id', shop.owner_id)
      
      // Delete shop
      await supabase.from('shops').delete().eq('id', shop.id)
      
      alert(`✅ Shop "${shop.name}" has been permanently deleted. They can now register again.`)
      setSelectedShop(null)
      load()
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete shop. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{ padding: '0 4px' }}>
      {selectedShop && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => { setSelectedShop(null); setShopDocs([]); setRejectReason('') }}
        >
          <div 
            style={{ background: 'white', borderRadius: 16, padding: 0, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>📋 Shop Details</h3>
              <button 
                onClick={() => { setSelectedShop(null); setShopDocs([]); setRejectReason('') }}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: '1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            
            {/* Modal Content */}
            <div style={{ padding: 20 }}>
              {/* Documents Section */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, color: '#0f172a' }}>📄 Uploaded Documents</h4>
                {shopDocs.length === 0 ? (
                  <div style={{ background: '#fef3c7', padding: 12, borderRadius: 8, fontSize: '0.85rem', color: '#92400e' }}>
                    No documents uploaded yet
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {shopDocs.map(doc => (
                      <div key={doc.id} style={{ background: '#f8fafc', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <div style={{ padding: '8px 12px', background: '#f1f5f9', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                          {doc.file_name || doc.doc_type}
                        </div>
                        {doc.file_url && (
                          <div style={{ padding: 8 }}>
                            <img 
                              src={doc.file_url} 
                              alt={doc.doc_type}
                              style={{ width: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 6, background: '#fff' }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Full Name</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedShop.full_name || '—'}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Phone</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedShop.phone || '—'}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Email</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedShop.email || '—'}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Shop Name</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedShop.name || '—'}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Category</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedShop.category || '—'}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>City</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedShop.city || '—'}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Registration Date</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{new Date(selectedShop.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Show rejection reason if exists */}
                {selectedShop.rejection_reason && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', marginBottom: 8, fontSize: '0.85rem', color: '#dc2626' }}>
                    ❌ Rejection Reason: <strong>{selectedShop.rejection_reason}</strong>
                  </div>
                )}
                
                {/* Show reapprove button for inactive/deactivated shops */}
                {selectedShop.is_approved && !selectedShop.is_active && (
                  <button 
                    onClick={() => reapproveShop(selectedShop)} 
                    disabled={processing}
                    style={{ padding: 14, background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer' }}
                  >
                    ✅ Reapprove & Activate
                  </button>
                )}
                
                {/* Show delete button for rejected shops */}
                {selectedShop.rejection_reason && (
                  <button 
                    onClick={() => deleteShopPermanently(selectedShop)} 
                    disabled={processing}
                    style={{ padding: 14, background: '#dc2626', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer' }}
                  >
                    🗑️ Delete Permanently
                  </button>
                )}
                
                {/* Show approve/reject buttons for pending shops */}
                {!selectedShop.is_approved && !selectedShop.rejection_reason && (
                  <>
                    <button 
                      onClick={() => approve(selectedShop.id)} 
                      disabled={processing || shopDocs.length === 0}
                      style={{ 
                        padding: 14, 
                        background: shopDocs.length === 0 ? '#94a3b8' : '#16a34a', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: 10, 
                        fontWeight: 700, 
                        cursor: shopDocs.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: shopDocs.length === 0 ? 0.6 : 1
                      }}
                    >
                      {shopDocs.length === 0 ? '⏳ Waiting for Documents' : '✅ Approve Shop'}
                    </button>
                    <div>
                      <textarea 
                        placeholder="Rejection reason (optional)" 
                        value={rejectReason} 
                        onChange={e => setRejectReason(e.target.value)} 
                        style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', minHeight: 80, boxSizing: 'border-box', marginBottom: 10 }} 
                      />
                      <button 
                        onClick={rejectShop} 
                        disabled={processing}
                        style={{ width: '100%', padding: 14, background: '#dc2626', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
                      >
                        ❌ Reject Shop
                      </button>
                    </div>
                  </>
                )}
                <button 
                  onClick={() => { setSelectedShop(null); setShopDocs([]); setRejectReason('') }} 
                  style={{ padding: 12, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ marginBottom: 16, fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>🏪 Shops</h2>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {(['pending', 'active', 'rejected', 'all'] as const).map(t => (
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
                  {shop.rejection_reason ? (
                    <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>Rejected</span>
                  ) : !shop.is_approved ? (
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
                  {!shop.is_approved && !shop.rejection_reason && (
                    <button onClick={() => handleSelectShop(shop)} style={{ background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Review</button>
                  )}
                  {shop.is_approved && (
                    <button onClick={() => toggleActive(shop)} style={{ background: shop.is_active ? '#fef3c7' : '#dcfce7', color: shop.is_active ? '#d97706' : '#16a34a', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      {shop.is_active ? '⏸️ Pause' : '▶️ Activate'}
                    </button>
                  )}
                  {/* Reapprove button for inactive/deactivated shops */}
                  {shop.is_approved && !shop.is_active && (
                    <button onClick={() => reapproveShop(shop)} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      ✅ Reapprove
                    </button>
                  )}
                  {/* Delete permanently button for rejected shops */}
                  {shop.rejection_reason && (
                    <button onClick={() => deleteShopPermanently(shop)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      🗑️ Delete
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