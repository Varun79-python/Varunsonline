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
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 16
        }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{
            background: 'white', borderRadius: 16, width: '100%', maxWidth: 520,
            maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>🏷️ Create Coupon</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748b', lineHeight: 1, padding: '2px 6px' }}>✕</button>
            </div>
            {/* Form body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Coupon Code */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: 6 }}>Coupon Code <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '1rem', fontFamily: 'monospace', letterSpacing: '0.1em', fontWeight: 700, color: '#ea580c', background: '#fff7ed', outline: 'none' }}
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SAVE20"
                />
              </div>
              {/* Description */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: 6 }}>Description</label>
                <input style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', color: '#1e293b', outline: 'none' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. 20% off for new users" />
              </div>
              {/* Type + Value */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: 6 }}>Discount Type</label>
                  <select style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', color: '#1e293b', background: 'white', outline: 'none' }} value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}>
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: 6 }}>Discount Value</label>
                  <input type="number" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', color: '#1e293b', outline: 'none' }} value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} placeholder={form.discount_type === 'percent' ? '20' : '50'} />
                </div>
              </div>
              {/* Min + Max */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: 6 }}>Min Order (₹)</label>
                  <input type="number" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', color: '#1e293b', outline: 'none' }} value={form.min_order_amount} onChange={e => setForm(f => ({ ...f, min_order_amount: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: 6 }}>Max Discount (₹)</label>
                  <input type="number" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', color: '#1e293b', outline: 'none' }} value={form.max_discount} onChange={e => setForm(f => ({ ...f, max_discount: e.target.value }))} placeholder="Optional" />
                </div>
              </div>
              {/* Valid Until */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: 6 }}>Valid Until</label>
                <input type="datetime-local" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', color: '#1e293b', outline: 'none' }} value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
              </div>
            </div>
            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10 }}>
              <button
                style={{ flex: 1, padding: '12px', background: '#f97316', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', opacity: saving || !form.code || !form.discount_value ? 0.6 : 1 }}
                onClick={save} disabled={saving || !form.code || !form.discount_value}>
                {saving ? 'Creating...' : '✅ Create Coupon'}
              </button>
              <button style={{ padding: '12px 20px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowForm(false)}>Cancel</button>
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
                <td>
                  <span style={{
                    display: 'inline-block',
                    fontWeight: 800, fontFamily: 'monospace', fontSize: '0.95rem',
                    color: '#ea580c', background: '#fff7ed',
                    border: '1.5px solid #fed7aa',
                    borderRadius: 6, padding: '3px 10px', letterSpacing: '0.05em'
                  }}>
                    {c.code || '—'}
                  </span>
                </td>
                <td>
                  <span style={{
                    display: 'inline-block', fontSize: '0.8rem', fontWeight: 700,
                    padding: '2px 8px', borderRadius: 6,
                    background: c.discount_type === 'percent' ? '#eff6ff' : '#f0fdf4',
                    color: c.discount_type === 'percent' ? '#2563eb' : '#16a34a',
                    border: `1px solid ${c.discount_type === 'percent' ? '#bfdbfe' : '#bbf7d0'}`
                  }}>
                    {c.discount_type === 'percent' ? '% Percent' : '₹ Flat'}
                  </span>
                </td>
                <td style={{ fontWeight: 700 }}>{c.discount_type === 'percent' ? `${c.discount_value}%` : `₹${c.discount_value}`}</td>
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
