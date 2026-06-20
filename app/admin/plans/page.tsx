'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/modules/infrastructure/supabase/client'

interface Plan {
  id: string; name: string; description: string
  plan_type: 'percentage' | 'fixed_monthly'
  fee_percent: number; monthly_fee: number; duration_days: number
  is_active: boolean; created_at: string
}

const emptyPlan: {
  name: string; description: string
  plan_type: 'percentage' | 'fixed_monthly'
  fee_percent: number; monthly_fee: number; duration_days: number; is_active: boolean
} = { name: '', description: '', plan_type: 'fixed_monthly', fee_percent: 0, monthly_fee: 299, duration_days: 30, is_active: true }

export default function AdminPlans() {
  const router = useRouter()
  const supabase = createClient()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [form, setForm] = useState({ ...emptyPlan })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  async function load() {
    setLoading(true)
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch('/api/admin/plans', { headers: { ...authHeader } })
      const data = await res.json()
      setPlans(data.plans || [])
    } catch {
      setMsg({ text: '❌ Failed to load plans', ok: false })
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  function openCreate() {
    setEditPlan(null)
    setForm({ ...emptyPlan })
    setShowModal(true)
  }

  function openEdit(p: Plan) {
    setEditPlan(p)
    setForm({ name: p.name, description: p.description, plan_type: p.plan_type, fee_percent: p.fee_percent, monthly_fee: p.monthly_fee, duration_days: p.duration_days, is_active: p.is_active })
    setShowModal(true)
  }

  async function save() {
    if (!form.name) return
    setSaving(true)
    try {
      const authHeader = await getAuthHeader()
      const method = editPlan ? 'PATCH' : 'POST'
      const body = editPlan ? { id: editPlan.id, ...form } : form
      const res = await fetch('/api/admin/plans', { method, headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      flash(editPlan ? '✅ Plan updated!' : '✅ Plan created!')
      setShowModal(false)
      load()
    } catch (e) {
      flash(`❌ ${(e as Error).message}`, false)
    }
    setSaving(false)
  }

  async function toggleActive(p: Plan) {
    try {
      const authHeader = await getAuthHeader()
      await fetch('/api/admin/plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ id: p.id, is_active: !p.is_active }) })
      load()
    } catch { flash('❌ Update failed', false) }
  }

  async function deletePlan(p: Plan) {
    if (!confirm(`Delete plan "${p.name}"? This cannot be undone.`)) return
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`/api/admin/plans?id=${p.id}`, { method: 'DELETE', headers: { ...authHeader } })
      if (!res.ok) throw new Error()
      flash('🗑 Plan deleted')
      load()
    } catch { flash('❌ Delete failed', false) }
  }

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', marginBottom: 14, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Command Center
          </button>
          <h2 style={{ marginBottom: 4 }}>📋 Subscription Plans</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Create plans here. Shopkeepers will choose their preferred plan from these options.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Plan</button>
      </div>

      {msg && (
        <div style={{ background: msg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: msg.ok ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{msg.text}</div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {plans.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>No Plans Yet</div>
              <div style={{ fontSize: '0.85rem', marginBottom: 20 }}>Create your first plan. Shopkeepers will choose from these when activating their shop.</div>
              <button className="btn btn-primary" onClick={openCreate}>+ Create First Plan</button>
            </div>
          )}
          {plans.map(p => (
            <div key={p.id} className="card" style={{ borderLeft: `4px solid ${p.plan_type === 'percentage' ? 'var(--primary)' : '#8b5cf6'}`, opacity: p.is_active ? 1 : 0.55 }}>
              <div className="flex-between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>{p.name}</span>
                  <span className={`badge ${p.plan_type === 'percentage' ? 'badge-blue' : 'badge-green'}`} style={{ marginLeft: 10 }}>
                    {p.plan_type === 'percentage' ? `${p.fee_percent}% per order` : `₹${p.monthly_fee}/month`}
                  </span>
                  {!p.is_active && <span className="badge" style={{ marginLeft: 6, background: 'var(--danger)', color: 'white', fontSize: '0.72rem' }}>Hidden from shopkeepers</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-sm" style={{ background: 'var(--bg-2)' }} onClick={() => openEdit(p)}>✏️ Edit</button>
                  <button
                    className="btn btn-sm"
                    style={{ background: p.is_active ? '#fef3c7' : 'var(--bg-2)', color: p.is_active ? '#d97706' : 'inherit' }}
                    onClick={() => toggleActive(p)}
                  >
                    {p.is_active ? '⏸ Hide' : '▶ Show'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => deletePlan(p)}>🗑</button>
                </div>
              </div>
              {p.description && <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>{p.description}</p>}
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {p.plan_type === 'fixed_monthly' && <span>⏱ {p.duration_days}-day validity</span>}
                {p.plan_type === 'percentage' && <span>💡 No upfront payment — deducted per order</span>}
                <span>Added {new Date(p.created_at).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ alignItems: 'center', overflowY: 'auto', padding: '20px' }}>
          <div className="modal" style={{ maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto', margin: 'auto' }}>
            <div className="modal-header">
              <h3>{editPlan ? '✏️ Edit Plan' : '➕ Create Plan'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div className="input-group">
                <label className="input-label">Plan Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Monthly Basic, Commission Plan" />
              </div>

              <div className="input-group">
                <label className="input-label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What the shopkeeper gets with this plan" style={{ resize: 'vertical' }} />
              </div>

              <div className="input-group">
                <label className="input-label">Pricing Model *</label>
                <select className="input" value={form.plan_type} onChange={e => setForm(f => ({ ...f, plan_type: e.target.value as 'percentage' | 'fixed_monthly' }))}>
                  <option value="fixed_monthly">Fixed Monthly Fee — shopkeeper pays upfront</option>
                  <option value="percentage">Percentage Per Order — deducted from earnings</option>
                </select>
              </div>

              {form.plan_type === 'percentage' ? (
                <div className="input-group">
                  <label className="input-label">Commission % per order</label>
                  <input className="input" type="number" step="0.5" min="0" max="50" value={form.fee_percent}
                    onChange={e => setForm(f => ({ ...f, fee_percent: Number(e.target.value) }))} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Example: 5% on a ₹1000 order = ₹50 platform fee auto-deducted
                  </span>
                </div>
              ) : (
                <>
                  <div className="input-group">
                    <label className="input-label">Monthly Fee (₹)</label>
                    <input className="input" type="number" min="0" value={form.monthly_fee}
                      onChange={e => setForm(f => ({ ...f, monthly_fee: Number(e.target.value) }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Validity (days)</label>
                    <input className="input" type="number" min="1" value={form.duration_days}
                      onChange={e => setForm(f => ({ ...f, duration_days: Number(e.target.value) }))} />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <input type="checkbox" id="planActive" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <label htmlFor="planActive" style={{ fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                  Visible to shopkeepers
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 6 }}>(uncheck to hide without deleting)</span>
                </label>
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
