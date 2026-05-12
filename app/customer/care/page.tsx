'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Complaint {
  id: string
  subject: string
  description: string
  complaint_type: string
  status: string
  created_at: string
  resolved_at: string | null
}

const COMPLAINT_TYPES = [
  { value: 'order', label: 'Order Issue', icon: '📦' },
  { value: 'delivery', label: 'Delivery Issue', icon: '🚴' },
  { value: 'product', label: 'Product Issue', icon: '🛍️' },
  { value: 'payment', label: 'Payment Issue', icon: '💳' },
  { value: 'shop', label: 'Shop Issue', icon: '🏪' },
  { value: 'other', label: 'Other', icon: '💬' },
]

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#fef3c7', color: '#d97706', label: 'Pending' },
  in_progress: { bg: '#dbeafe', color: '#2563eb', label: 'In Progress' },
  resolved: { bg: '#dcfce7', color: '#16a34a', label: 'Resolved' },
  rejected: { bg: '#fee2e2', color: '#dc2626', label: 'Rejected' },
}

const PhoneIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
const MessageIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>

export default function CustomerCarePage() {
  const router = useRouter()
  const supabase = createClient()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ complaint_type: 'order', subject: '', description: '', order_id: '' })
  const [orders, setOrders] = useState<{ id: string; order_number: string }[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [complaintsRes, ordersRes] = await Promise.all([
      supabase.from('customer_complaints').select('*').eq('customer_id', user.id).order('created_at', { ascending: false }),
      supabase.from('orders').select('id, order_number').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(20)
    ])

    setComplaints(complaintsRes.data || [])
    setOrders(ordersRes.data || [])
    setLoading(false)
  }

  async function submitComplaint() {
    if (!form.subject || !form.description) {
      alert('Please fill all required fields')
      return
    }
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    const { error } = await supabase.from('customer_complaints').insert({
      customer_id: user.id,
      order_id: form.order_id || null,
      subject: form.subject,
      description: form.description,
      complaint_type: form.complaint_type,
    })

    if (error) {
      alert('Failed to submit: ' + error.message)
    } else {
      setForm({ complaint_type: 'order', subject: '', description: '', order_id: '' })
      setShowForm(false)
      loadData()
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: '0 16px 100px', background: '#f8fafc', minHeight: '100vh' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Customer Care</h2>
      </div>

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            width: '100%', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            color: 'white', border: 'none', borderRadius: 14, padding: '16px',
            fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginBottom: 20,
            boxShadow: '0 4px 16px rgba(249,115,22,0.3)'
          }}
        >
          ➕ Raise a Complaint
        </button>
      )}

      {showForm && (
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>📝 New Complaint</h3>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Complaint Type *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {COMPLAINT_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setForm(f => ({ ...f, complaint_type: type.value }))}
                  style={{
                    padding: '8px 14px', borderRadius: 20, border: '1.5px solid',
                    borderColor: form.complaint_type === type.value ? '#f97316' : '#e2e8f0',
                    background: form.complaint_type === type.value ? '#fff7ed' : 'white',
                    color: form.complaint_type === type.value ? '#ea580c' : '#64748b',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {type.icon} {type.label}
                </button>
              ))}
            </div>
          </div>

          {orders.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Related Order (Optional)</label>
              <select
                value={form.order_id}
                onChange={e => setForm(f => ({ ...f, order_id: e.target.value }))}
                style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem' }}
              >
                <option value="">Select an order</option>
                {orders.map(o => <option key={o.id} value={o.id}>{o.order_number}</option>)}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Subject *</label>
            <input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Brief summary of the issue"
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Description *</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe your issue in detail..."
              rows={4}
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, background: '#f1f5f9', border: 'none', color: '#475569', padding: '14px', borderRadius: 12, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={submitComplaint} disabled={submitting} style={{ flex: 1, background: submitting ? '#94a3b8' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', border: 'none', color: 'white', padding: '14px', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Submitting...' : 'Submit Complaint'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>My Complaints ({complaints.length})</h3>
      </div>

      {complaints.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'white', borderRadius: 16 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>💬</div>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No complaints yet</p>
        </div>
      ) : (
        complaints.map(complaint => {
          const sc = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.pending
          return (
            <div key={complaint.id} style={{ background: 'white', borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{complaint.subject}</span>
                <span style={{ background: sc.bg, color: sc.color, fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
                  {sc.label}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 8 }}>{complaint.description}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.7rem', color: '#94a3b8' }}>
                <span>{new Date(complaint.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 6 }}>{complaint.complaint_type}</span>
                {complaint.resolved_at && (
                  <span style={{ color: '#16a34a' }}>Resolved: {new Date(complaint.resolved_at).toLocaleDateString('en-IN')}</span>
                )}
              </div>
            </div>
          )
        })
      )}

      <div style={{ marginTop: 24, padding: 16, background: 'white', borderRadius: 14, textAlign: 'center' }}>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 12 }}>Need immediate help?</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ flex: 1, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', padding: '12px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <PhoneIcon /> Call Us
          </button>
          <button style={{ flex: 1, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', padding: '12px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <MessageIcon /> Chat
          </button>
        </div>
      </div>
    </div>
  )
}