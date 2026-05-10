'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Product { id: string; name: string; category: string; price: number; mrp: number; stock_quantity: number; is_available: boolean; image_url: string }
interface Shop { id: string; category: string }

export default function ProductsPage() {
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
      const { data: shopData } = await supabase.from('shops').select('id, category').eq('owner_id', user.id).single()
      if (!shopData) return
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
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <div>
          <h2>🏷️ Products ({products.length})</h2>
          {shop?.category && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Shop Category: <strong style={{ color: 'var(--primary)' }}>{shop.category}</strong>
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Product</button>
      </div>

      <div className="search-bar" style={{ marginBottom: 20 }}>
        <span className="search-icon">🔍</span>
        <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div>
                <h3>{editing ? 'Edit Product' : 'Add New Product'}</h3>
                {shop?.category && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Will be listed under: <strong>{shop.category}</strong>
                  </div>
                )}
              </div>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="input-group" style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Product Name *</label>
                <input className="input" placeholder="e.g. Fresh Bread, Amul Butter..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Selling Price (₹) *</label>
                <input className="input" type="number" placeholder="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">MRP (₹) <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>optional</span></label>
                <input className="input" type="number" placeholder="Leave blank if same" value={form.mrp} onChange={e => setForm(f => ({ ...f, mrp: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Stock Quantity</label>
                <input className="input" type="number" placeholder="0 = unlimited" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Unit</label>
                <select className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  {['piece', 'kg', 'g', 'litre', 'ml', 'packet', 'box', 'dozen'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="input-group" style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Image URL <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>optional</span></label>
                <input className="input" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', gridColumn: '1/-1' }}>
                <input type="checkbox" checked={form.is_available} onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} />
                <span>Available for sale</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveProduct} disabled={saving || !form.name || !form.price}>
                {saving ? 'Saving...' : editing ? 'Update Product' : 'Add Product'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🛍️</div>
          <h3 style={{ marginBottom: 8 }}>{search ? 'No products match your search' : 'No Products Yet'}</h3>
          <p style={{ marginBottom: 20 }}>{search ? 'Try a different search term' : 'Add your first product to start selling!'}</p>
          {!search && <button className="btn btn-primary" onClick={openNew}>+ Add First Product</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {filtered.map(p => (
            <div key={p.id} className="card" style={{ opacity: p.is_available ? 1 : 0.6 }}>
              {p.image_url
                ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} />
                : <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', marginBottom: 12 }}>🛍️</div>
              }
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>Stock: {p.stock_quantity}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 800, color: 'var(--primary)' }}>₹{p.price}</span>
                {p.mrp > p.price && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textDecoration: 'line-through' }}>₹{p.mrp}</span>}
                <span className={`badge ${p.is_available ? 'badge-green' : 'badge-gray'}`} style={{ marginLeft: 'auto' }}>{p.is_available ? 'Active' : 'Hidden'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openEdit(p)}>✏️ Edit</button>
                <button className="btn btn-outline btn-sm" onClick={() => toggleAvail(p)}>{p.is_available ? 'Hide' : 'Show'}</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(p.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
