'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAdminShops, approveShopkeeperDocuments, rejectShopkeeperDocuments, deleteShopkeeperShop, blockShopkeeperShop, unblockShopkeeperShop } from '@/app/admin/actions'

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
  address_line1?: string
  landmark?: string
  description?: string
  latitude?: number
  longitude?: number
  upi_id?: string
  bank_account_number?: string
  bank_ifsc?: string
  is_approved: boolean
  is_active: boolean
  is_open?: boolean
  image_url: string
  rejection_reason: string | null
  created_at: string
  rating: number
  total_orders: number
  // Document specific
  aadhar_url?: string
}
interface ShopOrder {
  id: string; order_number: string; status: string; total_amount: number
  shopkeeper_earning: number; created_at: string
}

export default function AdminShops() {
  const supabase = createClient()
  const [items, setItems] = useState<UnifiedShop[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<UnifiedShop | null>(null)
  const [shopOrders, setShopOrders] = useState<ShopOrder[]>([])
  const [shopOrdersLoading, setShopOrdersLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [stats, setStats] = useState({ pendingDocs: 0 })
  const [processing, setProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  
  const loadingRef = useRef(false)
  const mountedRef = useRef(false)

  useEffect(() => { mountedRef.current = true }, [])

  async function load() {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setErrorMsg('')
    
    try {
      const result = await getAdminShops(tab)
      if (!mountedRef.current) return
      // Server action may return an error field instead of throwing
      if ('error' in result && result.error) {
        setErrorMsg(result.error as string)
        setItems([])
        setStats({ pendingDocs: 0 })
      } else {
        setItems((result.items || []) as UnifiedShop[])
        setStats({ pendingDocs: result.pendingDocs || 0 })
      }
    } catch (err: any) {
      if (mountedRef.current) {
        // Next.js server action errors surface as plain Error objects
        const msg = err?.message || 'Failed to load data. Check Supabase connection.'
        setErrorMsg(msg)
      }
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
    setShopOrders([])
    if (item.type === 'shop') {
      // Load orders for this shop
      setShopOrdersLoading(true)
      supabase.from('orders').select('id,order_number,status,total_amount,shopkeeper_earning,created_at')
        .eq('shop_id', item.id).order('created_at', { ascending: false }).limit(20)
        .then(({ data }) => {
          setShopOrders((data || []) as ShopOrder[])
          setShopOrdersLoading(false)
        })
    }
  }

  async function approve(item: UnifiedShop) {
    setProcessing(true)
    if (item.type === 'document') {
      // Use server action — bypasses RLS for shop creation
      const result = await approveShopkeeperDocuments(item.id, item.user_id)
      if (result.error) {
        alert('Approval failed: ' + result.error)
        setProcessing(false)
        return
      }
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
      // Use server action — bypasses RLS
      await rejectShopkeeperDocuments(selectedItem.id, selectedItem.user_id, reason)
    } else {
      await supabase.from('shops').update({
        is_approved: false,
        is_active: false,
        rejection_reason: reason
      }).eq('id', selectedItem.id)
      await supabase.from('notifications').insert({
        user_id: selectedItem.user_id,
        title: '❌ Registration Rejected',
        body: reason,
        type: 'shop_rejected'
      })
    }
    
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
      const { data: profile } = await supabase.from('profiles').select('full_name, phone, email').eq('id', item.user_id).maybeSingle()
      const { data: existingShop } = await supabase.from('shops').select('id').eq('owner_id', item.user_id).maybeSingle()
      if (!existingShop) {
        await supabase.from('shops').insert({
          owner_id: item.user_id,
          name: profile?.full_name ? `${profile.full_name}'s Shop` : 'My Shop',
          full_name: profile?.full_name || '',
          phone: profile?.phone || '',
          email: profile?.email || '',
          is_approved: true,
          is_active: true,
        })
      } else {
        await supabase.from('shops').update({ is_approved: true, is_active: true, rejection_reason: null }).eq('owner_id', item.user_id)
      }
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

  async function handleBlockShop(item: UnifiedShop) {
    if (!confirm(`Are you sure you want to BLOCK ${item.name}?`)) return
    setProcessing(true)
    const res = await blockShopkeeperShop(item.user_id)
    if (res.error) {
      alert('Block failed: ' + res.error)
    } else {
      alert('Shop blocked successfully.')
      setSelectedItem(null)
      load()
    }
    setProcessing(false)
  }

  async function handleUnblockShop(item: UnifiedShop) {
    if (!confirm(`Are you sure you want to UNBLOCK ${item.name}?`)) return
    setProcessing(true)
    const res = await unblockShopkeeperShop(item.user_id)
    if (res.error) {
      alert('Unblock failed: ' + res.error)
    } else {
      alert('Shop unblocked successfully.')
      setSelectedItem(null)
      load()
    }
    setProcessing(false)
  }

  async function handleDeleteShop(item: UnifiedShop) {
    if (!confirm(`⚠️ WARNING: Are you sure you want to delete ${item.name}'s registration?\nThis will permanently delete their shop and documents. They will have to register again from the start.`)) return
    setProcessing(true)
    const res = await deleteShopkeeperShop(item.user_id)
    if (res.error) {
      alert('Delete failed: ' + res.error)
    } else {
      alert('Shop registration deleted successfully.')
      setSelectedItem(null)
      load()
    }
    setProcessing(false)
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
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Address</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedItem.address_line1 || '—'}{selectedItem.landmark ? ` (${selectedItem.landmark})` : ''}</div>
                    </div>
                    {selectedItem.description && (
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Description</div>
                        <div style={{ fontWeight: 500, fontSize: '0.82rem' }}>{selectedItem.description}</div>
                      </div>
                    )}
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Rating</div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>⭐ {selectedItem.rating?.toFixed(1) || '—'}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Total Orders</div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>📦 {selectedItem.total_orders || 0}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Status</div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{selectedItem.is_open ? '🟢 Open' : '🔴 Closed'}</div>
                    </div>
                    {selectedItem.upi_id && (
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>UPI ID</div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{selectedItem.upi_id}</div>
                      </div>
                    )}
                    {selectedItem.latitude && (
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>GPS Coordinates</div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>📍 {selectedItem.latitude?.toFixed(5)}, {selectedItem.longitude?.toFixed(5)}</div>
                      </div>
                    )}
                  </>
                )}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Registration Date</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{new Date(selectedItem.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
              </div>

              {/* Shop Orders */}
              {selectedItem.type === 'shop' && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase' }}>📦 Orders from this Shop</h4>
                  {shopOrdersLoading ? <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Loading orders...</div> :
                  shopOrders.length === 0 ? <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No orders yet.</div> :
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                    {shopOrders.map(ord => (
                      <div key={ord.id} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>#{ord.order_number}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{new Date(ord.created_at).toLocaleDateString('en-IN')}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#16a34a' }}>₹{ord.shopkeeper_earning?.toFixed(0)}</div>
                          <div style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: 99, background: ord.status === 'delivered' ? '#dcfce7' : '#fef3c7', color: ord.status === 'delivered' ? '#16a34a' : '#d97706', display: 'inline-block' }}>{ord.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>}
                </div>
              )}

              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedItem.rejection_reason && selectedItem.rejection_reason !== 'BLOCKED' && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', marginBottom: 8, fontSize: '0.85rem', color: '#dc2626' }}>
                    ❌ Rejection Reason: <strong>{selectedItem.rejection_reason}</strong>
                  </div>
                )}
                {selectedItem.rejection_reason === 'BLOCKED' && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', marginBottom: 8, fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>
                    🚫 This shop has been Blocked by the Admin.
                  </div>
                )}
                
                {selectedItem.is_approved && !selectedItem.is_active && selectedItem.type === 'shop' && selectedItem.rejection_reason !== 'BLOCKED' && (
                  <button onClick={() => reapproveShop(selectedItem)} disabled={processing} style={{ padding: 14, background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer' }}>
                    ✅ Reapprove & Activate
                  </button>
                )}

                {selectedItem.type === 'shop' && selectedItem.is_approved && (
                  selectedItem.rejection_reason === 'BLOCKED' ? (
                    <button onClick={() => handleUnblockShop(selectedItem)} disabled={processing} style={{ padding: 14, background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                      🔓 Unblock Shop
                    </button>
                  ) : (
                    <button onClick={() => handleBlockShop(selectedItem)} disabled={processing} style={{ padding: 14, background: '#dc2626', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                      🚫 Block Shop
                    </button>
                  )
                )}

                <button onClick={() => handleDeleteShop(selectedItem)} disabled={processing} style={{ padding: 14, background: '#be123c', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                  🗑️ Delete Shopkeeper Registration
                </button>
                
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

      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
          <div style={{ color: '#dc2626', fontWeight: 700, marginBottom: 4 }}>⚠️ Error loading data</div>
          <div style={{ color: '#7f1d1d', fontSize: '0.85rem', marginBottom: 12 }}>{errorMsg}</div>
          <button
            onClick={() => load()}
            style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
          >
            🔄 Retry
          </button>
        </div>
      )}

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{item.name}</span>
                    {/* ℹ️ Info button — opens detail modal for any shop/registration */}
                    <button
                      onClick={() => handleSelectShop(item)}
                      title="View Details"
                      style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.75rem', color: '#3b82f6', fontWeight: 700, flexShrink: 0 }}
                    >
                      ℹ
                    </button>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.type === 'document' ? 'Registration' : `${item.category} • ${item.city || 'N/A'}`}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {!item.is_approved && !item.rejection_reason ? (
                    <span style={{ background: '#fef3c7', color: '#d97706', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>Pending</span>
                  ) : item.rejection_reason === 'BLOCKED' ? (
                    <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>Blocked</span>
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
                    item.rejection_reason === 'BLOCKED' ? (
                      <button onClick={() => handleUnblockShop(item)} style={{ background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                        🔓 Unblock
                      </button>
                    ) : (
                      <>
                        <button onClick={() => toggleActive(item)} style={{ background: item.is_active ? '#fef3c7' : '#dcfce7', color: item.is_active ? '#d97706' : '#16a34a', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                          {item.is_active ? '⏸️ Pause' : '▶️ Activate'}
                        </button>
                        <button onClick={() => handleBlockShop(item)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                          🚫 Block
                        </button>
                      </>
                    )
                  )}
                  {item.is_approved && !item.is_active && item.type === 'shop' && item.rejection_reason !== 'BLOCKED' && (
                    <button onClick={() => reapproveShop(item)} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      ✅ Reapprove
                    </button>
                  )}
                  <button onClick={() => handleDeleteShop(item)} style={{ background: '#be123c', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}