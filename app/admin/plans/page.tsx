'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Plan {
  id: string; name: string; description: string
  plan_type: 'percentage' | 'fixed_monthly'
  fee_percent: number; monthly_fee: number; duration_days: number
  is_active: boolean; created_at: string
}

const emptyPlan: { name: string; description: string; plan_type: 'percentage' | 'fixed_monthly'; fee_percent: number; monthly_fee: number; duration_days: number; is_active: boolean } = {
  name: '', description: '', plan_type: 'fixed_monthly', fee_percent: 0, monthly_fee: 299, duration_days: 30, is_active: true
}

export default function AdminPlans() {
  const supabase = createClient()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [form, setForm] = useState(emptyPlan)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('subscription_plans').select('*').order('created_at', { ascending: false })
    setPlans(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditPlan(null)
    setForm(emptyPlan)
    setShowModal(true)
  }

  function openEdit(p: Plan) {
    setEditPlan(p)
    setForm({ name: p.name, description: p.description, plan_type: p.plan_type, fee_percent: p.fee_percent, monthly_fee: p.monthly_fee, duration_days: p.duration_days, is_active: p.is_active })
    setShowModal(true)
  }

  async function save() {
    setSaving(true)
    setMsg('')
    if (editPlan) {
      await supabase.from('subscription_plans').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editPlan.id)
    } else {
      await supabase.from('subscription_plans').insert({ ...form })
    }
    setSaving(false)
    setShowModal(false)
    setMsg(editPlan ? '✅ Plan updated!' : '✅ Plan created!')
    load()
    setTimeout(() => setMsg(''), 4000)
  }

  async function toggleActive(p: Plan) {
    await supabase.from('subscription_plans').update({ is_active: !p.is_active }).eq('id', p.id)
    load()
  }

  async function deletePlan(p: Plan) {
    if (!confirm(`Delete plan "${p.name}"? This cannot be undone.`)) return
    await supabase.from('subscription_plans').delete().eq('id', p.id)
    load()
  }

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>📋 Subscription Plans</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Shopkeepers must purchase a plan to activate their shop.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Plan</button>
      </div>

      {msg && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, color: 'var(--success)' }}>{msg}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {plans.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No plans yet. Create your first plan.</div>}
          {plans.map(p => (
            <div key={p.id} className="card" style={{ borderLeft: `4px solid ${p.plan_type === 'percentage' ? 'var(--primary)' : '#8b5cf6'}`, opacity: p.is_active ? 1 : 0.55 }}>
              <div className="flex-between" style={{ marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>{p.name}</span>
                  <span className={`badge ${p.plan_type === 'percentage' ? 'badge-blue' : 'badge-green'}`} style={{ marginLeft: 10 }}>
                    {p.plan_type === 'percentage' ? `${p.fee_percent}% per order` : `₹${p.monthly_fee}/month`}
                  </span>
                  {!p.is_active && <span className="badge" style={{ marginLeft: 6, background: 'var(--danger)', color: 'white' }}>Inactive</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm" style={{ background: 'var(--bg-2)' }} onClick={() => openEdit(p)}>✏️ Edit</button>
                  <button className="btn btn-sm" style={{ background: p.is_active ? '#fef3c7' : 'var(--bg-2)', color: p.is_active ? '#d97706' : 'inherit' }} onClick={() => toggleActive(p)}>
                    {p.is_active ? '⏸ Disable' : '▶ Enable'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => deletePlan(p)}>🗑</button>
                </div>
              </div>
              {p.description && <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 6 }}>{p.description}</p>}
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', gap: 16 }}>
                {p.plan_type === 'fixed_monthly' && <span>⏱ {p.duration_days} days validity</span>}
                <span>Created {new Date(p.created_at).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{editPlan ? '✏️ Edit Plan' : '➕ New Plan'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">Plan Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Monthly Pro" />
              </div>
              <div className="input-group">
                <label className="input-label">Description</label>
                <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What's included?" />
              </div>
              <div className="input-group">
                <label className="input-label">Plan Type *</label>
                <select className="input" value={form.plan_type} onChange={e => setForm(f => ({ ...f, plan_type: e.target.value as 'percentage' | 'fixed_monthly' }))}>
                  <option value="fixed_monthly">Fixed Monthly Fee (shopkeeper pays upfront)</option>
                  <option value="percentage">Percentage Per Order (deducted from earnings)</option>
                </select>
              </div>
              {form.plan_type === 'percentage' ? (
                <div className="input-group">
                  <label className="input-label">Fee Percent (%)</label>
                  <input className="input" type="number" step="0.5" min="0" max="50" value={form.fee_percent} onChange={e => setForm(f => ({ ...f, fee_percent: Number(e.target.value) }))} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>e.g. 5 = ₹50 deducted from ₹1000 order</span>
                </div>
              ) : (
                <>
                  <div className="input-group">
                    <label className="input-label">Monthly Fee (₹)</label>
                    <input className="input" type="number" min="0" value={form.monthly_fee} onChange={e => setForm(f => ({ ...f, monthly_fee: Number(e.target.value) }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Validity (days)</label>
                    <input className="input" type="number" min="1" value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: Number(e.target.value) }))} />
                  </div>
                </>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="planActive" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: 18, height: 18 }} />
                <label htmlFor="planActive" style={{ fontWeight: 600 }}>Active (visible to shopkeepers)</label>
              </div>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.name}>
                {saving ? 'Saving...' : editPlan ? 'Update Plan' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
