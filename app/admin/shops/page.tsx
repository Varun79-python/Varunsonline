'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  getAdminShops,
  approveShopkeeperDocuments,
  rejectShopkeeperDocuments,
  deleteShopkeeperShop,
  blockShopkeeperShop,
  unblockShopkeeperShop,
  approveShop,
  rejectShop,
  toggleShopActive,
  reapproveShopRecord,
} from '@/app/admin/actions'
import { SkeletonCard, Skeleton } from '@/components/ui/skeleton'

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
  shopkeeper_earning: number; admin_earning?: number; payment_method?: string; created_at: string
}

export default function AdminShops() {
  const supabase = createClient()
  const [items, setItems] = useState<UnifiedShop[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<UnifiedShop | null>(null)
  const [shopOrders, setShopOrders] = useState<ShopOrder[]>([])
  const [shopOrdersLoading, setShopOrdersLoading] = useState(false)
  const [shopOwnerProfile, setShopOwnerProfile] = useState<{ full_name?: string; phone?: string; email?: string; created_at?: string } | null>(null)
  const [shopOrderCounts, setShopOrderCounts] = useState<{ total: number; delivered: number; cancelled: number; pending: number } | null>(null)
  const [shopTotalRevenue, setShopTotalRevenue] = useState<number>(0)
  const [rejectReason, setRejectReason] = useState('')
  const [stats, setStats] = useState({ pendingDocs: 0 })
  const [processing, setProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()
  
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
    } catch (err: unknown) {
      if (mountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Failed to load data. Check Supabase connection.'
        setErrorMsg(msg)
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        loadingRef.current = false
      }
    }
  }

  // Read initial tab from URL (client-only, avoids hydration mismatch)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (['pending', 'active', 'rejected', 'all'].includes(tabParam || '')) {
      setTab(tabParam as 'pending' | 'active' | 'rejected' | 'all')
    }
  }, [])

  useEffect(() => { 
    if (!loadingRef.current) load() 
  }, [tab])

  function clearSelectedItem() {
    setSelectedItem(null)
    setRejectReason('')
    setShopOrders([])
    setShopOwnerProfile(null)
    setShopOrderCounts(null)
    setShopTotalRevenue(0)
  }

  async function handleSelectShop(item: UnifiedShop) {
    setSelectedItem(item)
    setRejectReason('')
    setShopOrders([])
    setShopOwnerProfile(null)
    setShopOrderCounts(null)
    setShopTotalRevenue(0)
    if (item.type === 'shop') {
      setShopOrdersLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const headers: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
        const res = await fetch(`/api/admin/shop-detail?id=${item.id}`, { headers })
        if (res.ok) {
          const data = await res.json()
          setShopOrders(data.orders || [])
          setShopOwnerProfile(data.owner || null)
          setShopOrderCounts(data.orderCounts || null)
          setShopTotalRevenue(data.totalRevenue || 0)
        } else {
          setShopOrders([])
        }
      } catch {
        setShopOrders([])
      } finally {
        setShopOrdersLoading(false)
      }
    }
  }

  async function approve(item: UnifiedShop) {
    setProcessing(true)
    let result: { error?: string; success?: boolean }
    if (item.type === 'document') {
      // Server action — bypasses RLS via service_role key
      result = await approveShopkeeperDocuments(item.id, item.user_id)
    } else {
      // Server action — bypasses RLS via service_role key
      result = await approveShop(item.id, item.user_id)
    }
    if (result.error) {
      alert('Shop approval failed: ' + result.error)
      setProcessing(false)
      return
    }
    setItems(prev => prev.filter(s => s.id !== item.id))
    clearSelectedItem()
    setProcessing(false)
    load()
  }

  async function rejectItem() {
    if (!selectedItem) return
    setProcessing(true)
    const reason = rejectReason || 'Your registration was rejected by admin.'
    let result: { error?: string; success?: boolean }

    if (selectedItem.type === 'document') {
      result = await rejectShopkeeperDocuments(selectedItem.id, selectedItem.user_id, reason)
    } else {
      result = await rejectShop(selectedItem.id, selectedItem.user_id, reason)
    }

    if (result.error) {
      alert('Shop rejection failed: ' + result.error)
      setProcessing(false)
      return
    }

    setItems(prev => prev.filter(s => s.id !== selectedItem.id))
    clearSelectedItem()
    setProcessing(false)
    load()
  }

  async function toggleActive(item: UnifiedShop) {
    if (item.type === 'document') return
    const result = await toggleShopActive(item.id, item.is_active)
    if (result.error) {
      alert('Toggle active failed: ' + result.error)
      return
    }
    setItems(prev => prev.map(s => s.id === item.id ? { ...s, is_active: !s.is_active } : s))
  }

  async function reapproveShop(item: UnifiedShop) {
    if (!confirm(`Re-approve ${item.name}?`)) return
    setProcessing(true)
    const result = await reapproveShopRecord({
      id: item.id,
      type: item.type,
      user_id: item.user_id,
      name: item.name,
    })
    if (result.error) {
      alert('Re-approval failed: ' + result.error)
      setProcessing(false)
      return
    }
    setProcessing(false)
    load()
    clearSelectedItem()
  }

  async function handleBlockShop(item: UnifiedShop) {
    if (!confirm(`Are you sure you want to BLOCK ${item.name}?`)) return
    setProcessing(true)
    const res = await blockShopkeeperShop(item.user_id)
    if (res.error) {
      alert('Block failed: ' + res.error)
    } else {
      alert('Shop blocked successfully.')
      clearSelectedItem()
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
      clearSelectedItem()
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
      clearSelectedItem()
      load()
    }
    setProcessing(false)
  }

  return (
    <div className="sp-container">
      {selectedItem && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => clearSelectedItem()}
        >
          <div 
            style={{ background: 'white', borderRadius: 16, padding: 0, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>📋 {selectedItem.type === 'document' ? 'Registration Details' : 'Shop Details'}</h3>
              <button 
          onClick={() => clearSelectedItem()}
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
                {selectedItem.email && (
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Email</div>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{selectedItem.email}</div>
                  </div>
                )}
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
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Open Status</div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{selectedItem.is_open ? '🟢 Open' : '🔴 Closed'}</div>
                    </div>
                    {selectedItem.upi_id && (
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>UPI ID</div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{selectedItem.upi_id}</div>
                      </div>
                    )}
                    {selectedItem.bank_account_number && (
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Bank A/c No.</div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', fontFamily: 'monospace' }}>{selectedItem.bank_account_number}</div>
                      </div>
                    )}
                    {selectedItem.bank_ifsc && (
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Bank IFSC</div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', fontFamily: 'monospace' }}>{selectedItem.bank_ifsc}</div>
                      </div>
                    )}
                    {selectedItem.latitude && (
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>GPS Coordinates</div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>📍 {selectedItem.latitude?.toFixed(5)}, {selectedItem.longitude?.toFixed(5)}</div>
                      </div>
                    )}
                    {/* Order Stats */}
                    {shopOrderCounts && (
                      <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: 6 }}>📊 Order Summary</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Total: {shopOrderCounts.total}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#16a34a' }}>✅ Delivered: {shopOrderCounts.delivered}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d97706' }}>⏳ Pending: {shopOrderCounts.pending}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#dc2626' }}>❌ Cancelled: {shopOrderCounts.cancelled}</span>
                        </div>
                      </div>
                    )}
                    {shopTotalRevenue > 0 && (
                      <div style={{ background: '#fefce8', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>💰 Total Admin Revenue</div>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#16a34a' }}>₹{shopTotalRevenue.toFixed(0)}</div>
                      </div>
                    )}
                    {/* Owner Profile */}
                    {shopOwnerProfile && (
                      <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 8, gridColumn: 'span 2' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: 4 }}>👤 Owner Profile</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{shopOwnerProfile.full_name || '—'} {shopOwnerProfile.email ? `· ${shopOwnerProfile.email}` : ''}</div>
                        {shopOwnerProfile.created_at && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>Joined: {new Date(shopOwnerProfile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        )}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                      {shopOrders.map(ord => (
                        <div key={ord.id} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>#<span>{ord.order_number}</span></div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{new Date(ord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>₹{ord.total_amount?.toFixed(0)}</div>
                              <div style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 99, background: ord.status === 'delivered' ? '#dcfce7' : ord.status === 'cancelled' || ord.status === 'rejected' ? '#fee2e2' : '#fef3c7', color: ord.status === 'delivered' ? '#16a34a' : ord.status === 'cancelled' || ord.status === 'rejected' ? '#dc2626' : '#d97706', display: 'inline-block', marginTop: 2 }}>{ord.status}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: '0.72rem', color: '#64748b' }}>
                            <span>💵 Shop: <strong>₹{ord.shopkeeper_earning?.toFixed(0)}</strong></span>
                            {(ord as any).payment_method && <span>💳 {(ord as any).payment_method}</span>}
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
                <button onClick={() => clearSelectedItem()} style={{ padding: 12, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <div className="sp-section-label">Shop Management</div>
        <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2, marginBottom: 4 }}>🏪 Shops & Registrations</div>
        <div style={{ fontSize: '0.85rem', color: '#64748B' }}>Manage shop registrations and active shops</div>
      </div>
      
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
          {(['pending', 'active', 'rejected', 'all'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); if (typeof window !== 'undefined') { const url = new URL(window.location.href); url.searchParams.set('tab', t); window.history.replaceState({}, '', url.toString()) } }} style={{ 
            flex: '0 0 auto', padding: '10px 20px', borderRadius: 20, border: '1.5px solid', 
            background: tab === t ? '#f97316' : 'white', borderColor: tab === t ? '#f97316' : '#e2e8f0',
            color: tab === t ? 'white' : '#64748b', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'pending' && stats.pendingDocs > 0 && <span style={{ background: tab === t ? 'rgba(255,255,255,0.3)' : '#f97316', color: tab === t ? 'white' : 'white', padding: '2px 8px', borderRadius: 10, marginLeft: 6, fontSize: '0.75rem' }}>{stats.pendingDocs}</span>}
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

      {loading ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, background: 'white', borderRadius: 16, border: '1.5px solid #e2e8f0' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
              <p style={{ color: '#94A3B8', fontSize: '0.9rem', fontWeight: 500 }}>No records found</p>
            </div>
          )}
          {items.map(item => (
            <div className="sp-card" key={item.id}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                {item.image_url ? (
                  <img src={item.image_url} alt="" loading="lazy" decoding="async" style={{ width: 54, height: 54, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: '1px solid #f1f5f9' }} />
                ) : (
                  <div style={{ width: 54, height: 54, borderRadius: 12, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>📋</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item.type === 'shop' ? (
                        <button
                          onClick={() => router.push(`/admin/shops/${item.id}`)}
                          title="View full shop details"
                          style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0ea5e9', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '100%' }}
                        >
                          {item.name}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSelectShop(item)}
                          title="View Details"
                          style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'block', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          {item.name}
                        </button>
                      )}
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>{item.type === 'document' ? '📄 Registration' : `${item.category} • ${item.city || 'N/A'}`}</div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {!item.is_approved && !item.rejection_reason ? (
                        <span className="sp-badge sp-badge-pending">Pending</span>
                      ) : item.rejection_reason === 'BLOCKED' ? (
                        <span className="sp-badge sp-badge-blocked">Blocked</span>
                      ) : item.is_active || (item.type === 'document' && item.is_approved) ? (
                        <span className="sp-badge" style={{ background: '#dcfce7', color: '#16a34a' }}>{item.type === 'document' ? 'Approved' : 'Active'}</span>
                      ) : (
                        <span className="sp-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>Inactive</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                <div style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>👤 {item.full_name || 'N/A'}</span>
                  <span style={{ color: '#CBD5E1' }}>•</span>
                  <span>📱 {item.phone || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {!item.is_approved && !item.rejection_reason && (
                    <button onClick={() => handleSelectShop(item)} className="sp-btn" style={{ background: '#0ea5e9', color: 'white' }}>Review</button>
                  )}
                  {item.is_approved && item.type === 'shop' && (
                    item.rejection_reason === 'BLOCKED' ? (
                      <button onClick={() => handleUnblockShop(item)} className="sp-btn" style={{ background: '#dcfce7', color: '#16a34a' }}>
                        🔓 Unblock
                      </button>
                    ) : (
                      <>
                        <button onClick={() => toggleActive(item)} className="sp-btn" style={{ background: item.is_active ? '#fef3c7' : '#dcfce7', color: item.is_active ? '#d97706' : '#16a34a' }}>
                          {item.is_active ? '⏸️ Pause' : '▶️ Activate'}
                        </button>
                        <button onClick={() => handleBlockShop(item)} className="sp-btn" style={{ background: '#fee2e2', color: '#dc2626' }}>
                          🚫 Block
                        </button>
                      </>
                    )
                  )}
                  {item.is_approved && !item.is_active && item.type === 'shop' && item.rejection_reason !== 'BLOCKED' && (
                    <button onClick={() => reapproveShop(item)} className="sp-btn" style={{ background: '#22c55e', color: 'white' }}>
                      ✅ Reapprove
                    </button>
                  )}
                  <button onClick={() => handleDeleteShop(item)} className="sp-btn" style={{ background: '#be123c', color: 'white' }}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <style>{`
        .sp-container { max-width: 1000px; margin: 0 auto; }
        .sp-section-label { font-size: 0.75rem; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .sp-card {
          background: white;
          border-radius: 16px;
          border: 1.5px solid #E2E8F0;
          padding: 16px 18px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .sp-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .sp-badge {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 8px;
          white-space: nowrap;
        }
        .sp-badge-pending { background: #fef3c7; color: #d97706; }
        .sp-badge-blocked { background: #fee2e2; color: #dc2626; }
        .sp-btn {
          border: none;
          border-radius: 10px;
          padding: 8px 14px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s ease;
          white-space: nowrap;
        }
        .sp-btn:hover { opacity: 0.85; }
        .sp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        @media (max-width: 640px) {
          .sp-card { padding: 14px; }
        }
      `}</style>
    </div>
  )
}