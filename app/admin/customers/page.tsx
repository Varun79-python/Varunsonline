'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminCustomers() {
  const supabase = createClient()
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role', 'customer').order('created_at', { ascending: false })
      .then(({ data }) => setCustomers(data || []))
  }, [])

  const filtered = search ? customers.filter(c => (c.full_name as string)?.toLowerCase().includes(search.toLowerCase()) || (c.email as string)?.toLowerCase().includes(search.toLowerCase())) : customers

  return (
    <div className="fade-in">
      <h2 style={{ marginBottom: 20 }}>👥 Customers ({customers.length})</h2>
      <div className="search-bar" style={{ marginBottom: 20 }}>
        <span className="search-icon">🔍</span>
        <input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Joined</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30 }}>No customers found</td></tr>}
            {filtered.map(c => (
              <tr key={c.id as string}>
                <td style={{ fontWeight: 600 }}>{c.full_name as string || 'N/A'}</td>
                <td>{c.email as string}</td>
                <td>{c.phone as string || '—'}</td>
                <td><span className={`badge ${(c.is_active as boolean) ? 'badge-green' : 'badge-gray'}`}>{(c.is_active as boolean) ? 'Active' : 'Inactive'}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{new Date(c.created_at as string).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
