'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Agent {
  id: string; full_name: string; phone: string; vehicle_type: string
  vehicle_number: string; is_approved: boolean; is_available: boolean
  wallet_balance: number; total_deliveries: number; today_earnings: number
  created_at: string
}

export default function DeliveryProfilePage() {
  const supabase = createClient()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [email, setEmail] = useState('')
  const [form, setForm] = useState({ full_name: '', phone: '', vehicle_type: '', vehicle_number: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email || '')
    const { data } = await supabase.from('delivery_agents').select('*').eq('id', user.id).single()
    if (data) {
      setAgent(data)
      setForm({ full_name: data.full_name || '', phone: data.phone || '', vehicle_type: data.vehicle_type || '', vehicle_number: data.vehicle_number || '' })
    }
    setLoading(false)
  }

  async function save() {
    if (!agent) return
    setSaving(true)
    await supabase.from('delivery_agents').update(form).eq('id', agent.id)
    await supabase.from('profiles').update({ full_name: form.full_name }).eq('id', agent.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setAgent(a => a ? { ...a, ...form } : a)
  }

  async function toggleAvailability() {
    if (!agent) return
    const newVal = !agent.is_available
    await supabase.from('delivery_agents').update({ is_available: newVal }).eq('id', agent.id)
    setAgent(a => a ? { ...a, is_available: newVal } : a)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!agent) return (
    <div className="card" style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
      <h3 style={{ marginBottom: 8 }}>Not Registered</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>You haven&apos;t registered as a delivery agent yet.</p>
      <a href="/delivery/register" className="btn btn-primary">Register Now →</a>
    </div>
  )

  return (
    <div className="fade-in" style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 20 }}>👤 My Profile</h2>

      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>✅</div>
          <div style={{ fontWeight: 700, color: agent.is_approved ? 'var(--success)' : 'var(--warning)' }}>
            {agent.is_approved ? 'Approved' : 'Pending Approval'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Account Status</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>💰</div>
          <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.2rem' }}>₹{agent.wallet_balance || 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Wallet Balance</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>📦</div>
          <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{agent.total_deliveries || 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Deliveries</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>📅</div>
          <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1.2rem' }}>₹{agent.today_earnings || 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Today&apos;s Earnings</div>
        </div>
      </div>

      {/* Availability Toggle */}
      {agent.is_approved && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Availability Status</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {agent.is_available ? '🟢 You are online & accepting orders' : '🔴 You are offline'}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div onClick={toggleAvailability} style={{
              width: 48, height: 26, borderRadius: 13, position: 'relative', transition: 'background 0.2s',
              background: agent.is_available ? 'var(--success)' : 'var(--border)', cursor: 'pointer'
            }}>
              <div style={{
                position: 'absolute', top: 3, left: agent.is_available ? 25 : 3,
                width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s'
              }} />
            </div>
          </label>
        </div>
      )}

      {/* Edit Form */}
      <div className="card">
        <h3 style={{ marginBottom: 20 }}>✏️ Edit Profile</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input" value={email} disabled style={{ opacity: 0.6 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Your name" />
            </div>
            <div className="input-group">
              <label className="input-label">Phone Number</label>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit mobile" />
            </div>
            <div className="input-group">
              <label className="input-label">Vehicle Type</label>
              <select className="input" value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
                <option value="">Select vehicle</option>
                <option value="bicycle">🚲 Bicycle</option>
                <option value="motorcycle">🏍️ Motorcycle</option>
                <option value="scooter">🛵 Scooter</option>
                <option value="car">🚗 Car</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Vehicle Number</label>
              <input className="input" value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="e.g. TS09AB1234" />
            </div>
          </div>

          {saved && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--success)', fontSize: '0.85rem' }}>
              ✅ Profile updated successfully!
            </div>
          )}

          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </div>

      <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
        Member since {new Date(agent.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}
