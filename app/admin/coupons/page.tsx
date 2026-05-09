'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Coupon { id: string; code: string; description: string; discount_type: string; discount_value: number; min_order_amount: number; used_count: number; is_active: boolean; valid_until: string }

export default function AdminCoupons() {
  const supabase = createClient()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', description: '', discount_type: 'percent', discount_value: '', min_order_amount: '0', max_discount: '', valid_until: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('coupons').select('*').order('created_at', { ascending: false }).then(({ data }) => setCoupons(data || []))
  }, [])

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = { ...form, discount_value: Number(form.discount_value), min_order_amount: Number(form.min_order_amount), max_discount: form.max_discount ? Number(form.max_discount) : null, code: form.code.toUpperCase(), created_by: user?.id, valid_until: form.valid_until || null }
    const { data } = await supabase.from('coupons').insert(payload).select().single()
    if (data) { setCoupons(prev => [data, ...prev]); setShowForm(false) }
    setSaving(false)
  }

  async function toggle(c: Coupon) {
    await supabase.from('coupons').update({ is_active: !c.is_active }).eq('id', c.id)
    setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x))
  }

  async function deleteCoupon(id: string) {
    if (!confirm('Delete this coupon?')) return
    await supabase.from('coupons').delete().eq('id', id)
    setCoupons(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <h2>🏷️ Coupons & Discounts</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Create Coupon</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-header"><h3>Create Coupon</h3><button className="modal-close" onClick={() => setShowForm(false)}>✕</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="input-group" style={{ gridColumn: '1/-1' }}><label className="input-label">Coupon Code *</label><input className="input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. SAVE20" /></div>
              <div className="input-group" style={{ gridColumn: '1/-1' }}><label className="input-label">Description</label><input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Discount Type</label>
                <select className="input" value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}>
                  <option value="percent">Percentage (%)</option><option value="flat">Flat Amount (₹)</option>
                </select>
              </div>
              <div className="input-group"><label className="input-label">Discount Value</label><input className="input" type="number" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Min Order (₹)</label><input className="input" type="number" value={form.min_order_amount} onChange={e => setForm(f => ({ ...f, min_order_amount: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Max Discount (₹)</label><input className="input" type="number" value={form.max_discount} onChange={e => setForm(f => ({ ...f, max_discount: e.target.value }))} placeholder="Optional" /></div>
              <div className="input-group" style={{ gridColumn: '1/-1' }}><label className="input-label">Valid Until</label><input className="input" type="datetime-local" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Create Coupon'}</button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Used</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {coupons.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30 }}>No coupons yet</td></tr>}
            {coupons.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>{c.code}</td>
                <td>{c.discount_type === 'percent' ? '%' : '₹'} off</td>
                <td>{c.discount_type === 'percent' ? `${c.discount_value}%` : `₹${c.discount_value}`}</td>
                <td>₹{c.min_order_amount}</td>
                <td>{c.used_count}</td>
                <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{c.valid_until ? new Date(c.valid_until).toLocaleDateString('en-IN') : 'No limit'}</td>
                <td><span className={`badge ${c.is_active ? 'badge-green' : 'badge-gray'}`}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggle(c)}>{c.is_active ? 'Disable' : 'Enable'}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteCoupon(c.id)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
