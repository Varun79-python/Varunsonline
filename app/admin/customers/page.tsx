'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminCustomers() {
  const supabase = createClient() as any
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([])
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({ total: 0 })

  useEffect(() => {
    if (!supabase) return
    supabase.from('customers').select('*').order('created_at', { ascending: false })
      .then(({ data }: { data: any[] | null }) => {
        setCustomers(data || [])
        setStats({ total: data?.length || 0 })
      })
  }, [])

  const filtered = search ? customers.filter(c => (c.full_name as string)?.toLowerCase().includes(search.toLowerCase()) || (c.email as string)?.toLowerCase().includes(search.toLowerCase()) || (c.phone as string)?.includes(search)) : customers

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
            <div key={c.id as string} style={{ background: 'white', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{c.full_name as string || 'N/A'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.email as string}</div>
                </div>
                <span style={{ background: '#f97316', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>
                  {getCustomerId(customerIndex)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: '0.7rem', color: '#94a3b8' }}>
                <span>📱 {c.phone as string || 'N/A'}</span>
                <span>📅 Joined {new Date(c.created_at as string).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
