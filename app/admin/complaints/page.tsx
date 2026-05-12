'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Complaint {
  id: string
  customer_id: string
  order_id: string | null
  subject: string
  description: string
  complaint_type: string
  status: string
  created_at: string
  resolved_at: string | null
  customer_name?: string
  customer_email?: string
  order_number?: string
}

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#fef3c7', color: '#d97706', label: 'Pending' },
  in_progress: { bg: '#dbeafe', color: '#2563eb', label: 'In Progress' },
  resolved: { bg: '#dcfce7', color: '#16a34a', label: 'Resolved' },
  rejected: { bg: '#fee2e2', color: '#dc2626', label: 'Rejected' },
}

const TYPE_LABELS: Record<string, string> = {
  order: 'Order Issue',
  delivery: 'Delivery Issue',
  product: 'Product Issue',
  payment: 'Payment Issue',
  shop: 'Shop Issue',
  other: 'Other',
}

export default function AdminComplaintsPage() {
  const supabase = createClient()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    loadComplaints()
  }, [])

  async function loadComplaints() {
    const { data, error } = await supabase
      .from('customer_complaints')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const customerIds = [...new Set(data.map(c => c.customer_id))]
      const orderIds = [...new Set(data.filter(c => c.order_id).map(c => c.order_id))]

      const [customersRes, ordersRes] = await Promise.all([
        customerIds.length > 0 ? supabase.from('profiles').select('id, full_name, email').in('id', customerIds) : Promise.resolve({ data: [] }),
        orderIds.length > 0 ? supabase.from('orders').select('id, order_number').in('id', orderIds) : Promise.resolve({ data: [] })
      ])

      const customersMap = new Map((customersRes.data || []).map(c => [c.id, c]))
      const ordersMap = new Map((ordersRes.data || []).map(o => [o.id, o]))

      const enriched = data.map(c => ({
        ...c,
        customer_name: customersMap.get(c.customer_id)?.full_name || 'Unknown',
        customer_email: customersMap.get(c.customer_id)?.email || '',
        order_number: c.order_id ? ordersMap.get(c.order_id)?.order_number : null,
      }))
      setComplaints(enriched)
    }
    setLoading(false)
  }

  async function updateStatus(id: string, newStatus: string) {
    setUpdating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'resolved') {
      updates.resolved_by = user?.id
      updates.resolved_at = new Date().toISOString()
    }

    const { error } = await supabase.from('customer_complaints').update(updates).eq('id', id)
    if (!error) {
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
      setSelectedComplaint(null)
    }
    setUpdating(false)
  }

  const filtered = filter === 'all' ? complaints : complaints.filter(c => c.status === filter)
  const counts = { all: complaints.length, pending: complaints.filter(c => c.status === 'pending').length, in_progress: complaints.filter(c => c.status === 'in_progress').length, resolved: complaints.filter(c => c.status === 'resolved').length }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Loading...</div>

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Customer Complaints</h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Manage and resolve customer complaints</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[{ key: 'all', label: `All (${counts.all})` }, { key: 'pending', label: `Pending (${counts.pending})` }, { key: 'in_progress', label: 'In Progress' }, { key: 'resolved', label: 'Resolved' }].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid', borderColor: filter === f.key ? '#f97316' : '#e2e8f0', background: filter === f.key ? '#fff7ed' : 'white', color: filter === f.key ? '#ea580c' : '#64748b', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#f8fafc', borderRadius: 16 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📭</div>
          <p style={{ color: '#64748b' }}>No complaints found</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {filtered.map(complaint => {
            const sc = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.pending
            return (
              <div key={complaint.id} onClick={() => setSelectedComplaint(complaint)} style={{ background: 'white', borderRadius: 16, border: '1px solid #f1f5f9', padding: 20, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', marginBottom: 4 }}>{complaint.subject}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>From: {complaint.customer_name} ({complaint.customer_email})</div>
                  </div>
                  <span style={{ background: sc.bg, color: sc.color, fontSize: '0.75rem', fontWeight: 700, padding: '6px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>{sc.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: '#94a3b8' }}>
                  <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 6 }}>{TYPE_LABELS[complaint.complaint_type] || complaint.complaint_type}</span>
                  {complaint.order_number && <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 6 }}>Order: {complaint.order_number}</span>}
                  <span>{new Date(complaint.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedComplaint && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }} onClick={() => setSelectedComplaint(null)}>
          <div style={{ background: 'white', borderRadius: 20, maxWidth: 500, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Complaint Details</h2>
              <button onClick={() => setSelectedComplaint(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Customer</div>
              <div style={{ fontSize: '0.95rem', color: '#0f172a' }}>{selectedComplaint.customer_name}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{selectedComplaint.customer_email}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Type</div>
              <span style={{ background: '#f1f5f9', padding: '4px 12px', borderRadius: 6, fontSize: '0.85rem' }}>{TYPE_LABELS[selectedComplaint.complaint_type] || selectedComplaint.complaint_type}</span>
            </div>
            {selectedComplaint.order_number && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Related Order</div>
                <div style={{ fontSize: '0.95rem', color: '#f97316', fontWeight: 600 }}>{selectedComplaint.order_number}</div>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Subject</div>
              <div style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: 600 }}>{selectedComplaint.subject}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Description</div>
              <div style={{ fontSize: '0.9rem', color: '#374151', background: '#f8fafc', padding: 12, borderRadius: 10, lineHeight: 1.6 }}>{selectedComplaint.description}</div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Status</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['pending', 'in_progress', 'resolved', 'rejected'].map(status => {
                  const sc = STATUS_CONFIG[status]
                  const isActive = selectedComplaint.status === status
                  return (
                    <button key={status} onClick={() => updateStatus(selectedComplaint.id, status)} disabled={updating || isActive} style={{ padding: '10px 16px', borderRadius: 10, border: '1.5px solid', borderColor: isActive ? sc.color : '#e2e8f0', background: isActive ? sc.bg : 'white', color: isActive ? sc.color : '#64748b', fontWeight: 600, fontSize: '0.85rem', cursor: updating || isActive ? 'not-allowed' : 'pointer', opacity: updating ? 0.6 : 1 }}>
                      {status === 'resolved' ? '✓ Resolve' : sc.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Submitted: {new Date(selectedComplaint.created_at).toLocaleString('en-IN')}</div>
          </div>
        </div>
      )}
    </div>
  )
}