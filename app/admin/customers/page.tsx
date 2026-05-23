'use client'
import { useEffect, useState } from 'react'
import { getAdminCustomers } from '@/app/admin/actions'

interface AdminCustomer {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  created_at: string
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({ total: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const pageSize = 25

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data, count, error } = await getAdminCustomers(page, pageSize)
        if (error) throw error
        setCustomers((data || []) as AdminCustomer[])
        setStats({ total: count || 0 })
        setTotalPages(Math.ceil((count || 0) / pageSize))
      } catch (err) {
        console.error('Failed to load customers:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [page])

  const filtered = search ? customers.filter(c =>
    (c.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search)
  ) : customers

  function getCustomerId(index: number): string {
    return `CUST-${String(index + 1).padStart(4, '0')}`
  }

  return (
    <div style={{ padding: '0 4px' }}>
      <h2 style={{ marginBottom: 16, fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>👥 Customers ({stats.total})</h2>
      
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, background: '#f0fdf4', padding: 14, borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>{stats.total}</div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>Total Customers</div>
        </div>
      </div>
      
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem' }}>🔍</span>
        <input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, background: '#f8fafc', borderRadius: 12 }}>No customers found</div>
        )}
        {filtered.map((c, idx) => {
          const customerIndex = customers.indexOf(c)
          return (
            <div key={c.id} style={{ background: 'white', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{c.full_name || 'N/A'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.email ?? ''}</div>
                </div>
                <span style={{ background: '#f97316', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>
                  {getCustomerId(customerIndex)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: '0.7rem', color: '#94a3b8' }}>
                <span>📱 {c.phone || 'N/A'}</span>
                <span>📅 Joined {new Date(c.created_at).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20, padding: '12px 0' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ padding: '8px 16px', background: page <= 1 ? '#f1f5f9' : '#f97316', color: page <= 1 ? '#94a3b8' : 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ padding: '8px 16px', background: page >= totalPages ? '#f1f5f9' : '#f97316', color: page >= totalPages ? '#94a3b8' : 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
