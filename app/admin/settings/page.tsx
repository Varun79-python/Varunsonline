'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Setting { key: string; value: string; description: string }

const SETTING_LABELS: Record<string, string> = {
  shop_radius_km: 'Shop Radius (km)',
  platform_fee_percent: 'Platform Fee (%)',
  base_delivery_charge: 'Base Delivery Charge (₹)',
  per_km_delivery_charge: 'Per KM Delivery Charge (₹)',
  min_order_amount: 'Minimum Order Amount (₹)',
  max_order_amount: 'Maximum Order Amount (₹)',
}

export default function AdminSettings() {
  const supabase = createClient()
  const [settings, setSettings] = useState<Setting[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('platform_settings').select('*').then(({ data }) => setSettings(data || []))
  }, [])

  function update(key: string, value: string) {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s))
  }

  async function save() {
    setSaving(true)
    for (const s of settings) {
      await supabase.from('platform_settings').update({ value: s.value, updated_at: new Date().toISOString() }).eq('key', s.key)
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="fade-in" style={{ maxWidth: 600 }}>
      <h2 style={{ marginBottom: 8 }}>⚙️ Platform Settings</h2>
      <p style={{ marginBottom: 28 }}>Control all pricing and platform parameters from here.</p>

      {saved && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, color: 'var(--success)' }}>✅ Settings saved successfully!</div>}

      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {settings.map(s => (
            <div key={s.key}>
              <div className="input-group">
                <label className="input-label">{SETTING_LABELS[s.key] || s.key}</label>
                <input className="input" type="number" value={s.value} onChange={e => update(s.key, e.target.value)} />
                {s.description && <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 4 }}>{s.description}</p>}
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save All Settings'}</button>
      </div>
    </div>
  )
}
