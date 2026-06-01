'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAdminShopkeepers } from '@/app/admin/actions'

interface AdminShopkeeper {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  created_at: string
  is_active: boolean
}

export default function AdminShopkeepers() {
  const router = useRouter()
  const [shopkeepers, setShopkeepers] = useState<AdminShopkeeper[]>([])
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
        const { data, count, error } = await getAdminShopkeepers(page, pageSize)
        if (error) throw error
        setShopkeepers((data || []) as AdminShopkeeper[])
        setStats({ total: count || 0 })
        setTotalPages(Math.ceil((count || 0) / pageSize))
      } catch (err) {
        console.error('Failed to load shopkeepers:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [page])

  const filtered = search ? shopkeepers.filter(s =>
    (s.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.phone ?? '').includes(search)
  ) : shopkeepers

  return (
    <div className="skl-container">
      <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', marginBottom: 14, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Command Center
      </button>
      <div style={{ marginBottom: 28 }}>
        <div className="skl-section-label">Shopkeeper Management</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2, marginBottom: 4 }}>🏪 Shopkeepers</div>
            <div style={{ fontSize: '0.85rem', color: '#64748B' }}>View shopkeeper profiles, shops, orders, and activity</div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, background: '#fff7ed', padding: '14px 18px', borderRadius: 12, border: '1.5px solid #fed7aa' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ea580c' }}>{stats.total}</div>
          <div style={{ fontSize: '0.75rem', color: '#c2410c', fontWeight: 600 }}>Total Shopkeepers</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', opacity: 0.5 }}>🔍</span>
        <input
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Shopkeepers List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skl-card" style={{ height: 80 }} />)}</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, background: 'white', borderRadius: 16, border: '1.5px solid #e2e8f0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏪</div>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', fontWeight: 500 }}>No shopkeepers found</p>
          </div>
        )}
        {filtered.map(s => (
          <div className="skl-card" key={s.id}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0, border: '1px solid #fed7aa' }}>
                🏪
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button
                      onClick={() => router.push(`/admin/shopkeepers/${s.id}`)}
                      className="skl-name-btn"
                    >
                      {s.full_name || 'N/A'}
                    </button>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.email || ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 10 }}>
              <div style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📱 {s.phone || 'N/A'}</span>
                <span style={{ color: '#CBD5E1' }}>•</span>
                <span className={`skl-badge ${s.is_active ? 'skl-badge-active' : 'skl-badge-inactive'}`}>
                  {s.is_active ? '🟢 Active' : '🔴 Inactive'}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                📅 {new Date(s.created_at).toLocaleDateString('en-IN')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="skl-pagination">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="skl-page-btn"
            style={{ background: page <= 1 ? '#f1f5f9' : '#f97316', color: page <= 1 ? '#94a3b8' : 'white' }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="skl-page-btn"
            style={{ background: page >= totalPages ? '#f1f5f9' : '#f97316', color: page >= totalPages ? '#94a3b8' : 'white' }}
          >
            Next →
          </button>
        </div>
      )}

      <style>{`
        .skl-container { max-width: 1000px; margin: 0 auto; }
        .skl-section-label { font-size: 0.75rem; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .skl-card {
          background: white;
          border-radius: 16px;
          border: 1.5px solid #E2E8F0;
          padding: 14px 18px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .skl-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .skl-name-btn { background: none; border: none; padding: 0; margin: 0; cursor: pointer; font-weight: 800; font-size: 0.95rem; color: #f97316; text-decoration: underline; text-underline-offset: 2px; text-align: left; display: block; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .skl-name-btn:hover { opacity: 0.8; }
        .skl-badge { padding: 2px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; }
        .skl-badge-active { background: #dcfce7; color: #16a34a; }
        .skl-badge-inactive { background: #f1f5f9; color: #64748b; }
        .skl-pagination { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 24px; padding: 16px 0; }
        .skl-page-btn { border: none; border-radius: 10px; padding: 10px 20px; font-weight: 700; font-size: 0.82rem; cursor: pointer; transition: opacity 0.15s; }
        .skl-page-btn:hover:not(:disabled) { opacity: 0.85; }
        .skl-page-btn:disabled { cursor: not-allowed; }
        @media (max-width: 640px) {
          .skl-card { padding: 14px; }
        }
      `}</style>
    </div>
  )
}
