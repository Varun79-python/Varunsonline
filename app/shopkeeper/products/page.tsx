'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Product { id: string; name: string; category: string; price: number; mrp: number; stock_quantity: number; is_available: boolean; image_url: string }
interface Shop { id: string; category: string }

export default function ProductsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [shop, setShop] = useState<Shop | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', description: '', price: '', mrp: '', unit: 'piece', stock_quantity: '', is_available: true, image_url: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shopData } = await supabase.from('shops').select('id, category, is_approved, is_active').eq('owner_id', user.id).maybeSingle()
      if (!shopData || !shopData.is_approved || !shopData.is_active) { router.replace('/login/status'); return }
      setShop(shopData)
      const { data } = await supabase.from('products').select('*').eq('shop_id', shopData.id).order('name')
      setProducts(data || [])
    }
    load()
  }, [])

  function openNew() {
    setEditing(null)
    setForm({ name: '', description: '', price: '', mrp: '', unit: 'piece', stock_quantity: '', is_available: true, image_url: '' })
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({ name: p.name, description: '', price: String(p.price), mrp: String(p.mrp), unit: 'piece', stock_quantity: String(p.stock_quantity), is_available: p.is_available, image_url: p.image_url || '' })
    setShowForm(true)
  }

  async function saveProduct() {
    if (!shop) return
    setSaving(true)
    // Category is always the shop's own category — no manual selection needed
    const payload = {
      ...form,
      price: Number(form.price),
      mrp: Number(form.mrp) || Number(form.price),
      stock_quantity: Number(form.stock_quantity) || 0,
      category: shop.category,   // ← auto from shop
      shop_id: shop.id
    }
    if (editing) {
      const { data } = await supabase.from('products').update(payload).eq('id', editing.id).select().single()
      if (data) setProducts(prev => prev.map(p => p.id === editing.id ? data : p))
    } else {
      const { data } = await supabase.from('products').insert(payload).select().single()
      if (data) setProducts(prev => [...prev, data])
    }
    setSaving(false)
    setShowForm(false)
  }

  async function toggleAvail(p: Product) {
    await supabase.from('products').update({ is_available: !p.is_available }).eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_available: !x.is_available } : x))
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete this product?')) return
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  const filtered = search ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) : products

  return (
    <div style={{ padding: '0 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 2 }}>🏷️ Products</h2>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{products.length} items</div>
        </div>
        <button onClick={openNew} style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>+ Add</button>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem' }}>🔍</span>
        <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 440, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{editing ? 'Edit Product' : 'Add Product'}</h3>
                {shop?.category && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>Category: {shop.category}</div>}
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Product Name *</label>
                <input placeholder="e.g. Fresh Bread" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Price (₹) *</label>
                  <input type="number" placeholder="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>MRP (₹)</label>
                  <input type="number" placeholder="Optional" value={form.mrp} onChange={e => setForm(f => ({ ...f, mrp: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Stock</label>
                  <input type="number" placeholder="0" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }}>
                    {['piece', 'kg', 'g', 'litre', 'ml', 'packet', 'box', 'dozen'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Image URL</label>
                <input placeholder="https://..." value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_available} onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Available for sale</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, padding: 16, borderTop: '1px solid #e2e8f0' }}>
              <button onClick={saveProduct} disabled={saving || !form.name || !form.price} style={{ flex: 1, background: '#f97316', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 700, fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Add Product'}
              </button>
              <button onClick={() => setShowForm(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 600, fontSize: '0.9rem', color: '#475569', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: 16 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🛍️</div>
          <h3 style={{ marginBottom: 8, color: '#0f172a' }}>{search ? 'No products found' : 'No Products Yet'}</h3>
          <p style={{ marginBottom: 20, color: '#64748b' }}>{search ? 'Try a different search' : 'Add your first product!'}</p>
          {!search && <button onClick={openNew} style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, cursor: 'pointer' }}>+ Add Product</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ background: 'white', borderRadius: 12, border: '1.5px solid #e2e8f0', overflow: 'hidden', opacity: p.is_available ? 1 : 0.6 }}>
              {p.image_url
                ? <img src={p.image_url} alt={p.name} loading="lazy" decoding="async" style={{ width: '100%', height: 100, objectFit: 'cover' }} />
                : <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', background: '#f8fafc' }}>🛍️</div>
              }
              <div style={{ padding: 10 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>Stock: {p.stock_quantity}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 800, color: '#f97316', fontSize: '1rem' }}>₹{p.price}</span>
                  {p.mrp > p.price && <span style={{ fontSize: '0.75rem', color: '#94a3b8', textDecoration: 'line-through' }}>₹{p.mrp}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(p)} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '8px', fontSize: '0.7rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => toggleAvail(p)} style={{ background: p.is_available ? '#fef3c7' : '#dcfce7', border: 'none', borderRadius: 6, padding: '8px', fontSize: '0.7rem', fontWeight: 600, color: p.is_available ? '#d97706' : '#16a34a', cursor: 'pointer' }}>{p.is_available ? 'Hide' : 'Show'}</button>
                  <button onClick={() => deleteProduct(p.id)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '8px', fontSize: '0.7rem', fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
