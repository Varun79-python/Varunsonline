'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/admin', icon: '📊', label: 'Dashboard' },
  { href: '/admin/orders', icon: '📦', label: 'Orders' },
  { href: '/admin/shops', icon: '🏪', label: 'Shops' },
  { href: '/admin/agents', icon: '🛵', label: 'Agents' },
  { href: '/admin/customers', icon: '👥', label: 'Users' },
  { href: '/admin/withdrawals', icon: '💸', label: 'Payouts' },
  { href: '/admin/agent-settlements', icon: '💳', label: 'Settle' },
  { href: '/admin/plans', icon: '📋', label: 'Plans' },
  { href: '/admin/coupons', icon: '🏷️', label: 'Coupons' },
  { href: '/admin/complaints', icon: '🎫', label: 'Tickets' },
  { href: '/admin/settings', icon: '⚙️', label: 'Settings' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [adminName, setAdminName] = useState('')

  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (isLoginPage) { setChecking(false); return }

    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/admin/login'); return }

      const ADMIN_EMAIL = 'venkatavarun79@gmail.com'
      const metaRole = user.user_metadata?.role || user.app_metadata?.role
      if (metaRole === 'admin' || user.email === ADMIN_EMAIL) {
        setAdminName(user.user_metadata?.full_name || user.email || 'Admin')
        setChecking(false); return
      }

      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      if (!profile || profile.role !== 'admin') { await supabase.auth.signOut(); router.replace('/admin/login'); return }

      setAdminName(profile.full_name || user.email || 'Admin')
      setChecking(false)
    }
    checkAuth()
  }, [pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  if (isLoginPage) return <>{children}</>

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, border: '4px solid #334155', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#94a3b8' }}>Verifying admin access...</p>
      </div>
    )
  }

return (
    <div className="admin-layout">
      {/* Desktop Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <span style={{ fontSize: '1.5rem' }}>👑</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Varun's Online</div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Admin Panel</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <a key={item.href} href={item.href} className={`sidebar-link${isActive ? ' sidebar-active' : ''}`}>
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
              </a>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <div style={{ padding: '12px 16px', borderTop: '1px solid #334155' }}>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 8 }}>Logged in as Admin</div>
            <button onClick={handleLogout} style={{ width: '100%', padding: '10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Logout</button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f97316, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.1rem' }}>👑</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'white', lineHeight: 1.2 }}>Varun's Online</div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Admin Panel</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', borderRadius: 8, padding: '8px 12px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>Logout</button>
      </header>

      <main className="admin-main">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav className="admin-bottom-nav">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
          return (
            <a key={item.href} href={item.href} className={`admin-nav-item${isActive ? ' admin-nav-active' : ''}`}>
              <span className="admin-nav-icon">{item.icon}</span>
              <span className="admin-nav-label">{item.label}</span>
            </a>
          )
        })}
      </nav>

      <style>{`
        .admin-layout { min-height: 100vh; display: flex; background: #f8fafc; }
        .admin-sidebar { display: flex; flex-direction: column; width: 260px; background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%); position: fixed; top: 0; left: 0; bottom: 0; z-index: 50; }
        .sidebar-brand { display: flex; align-items: center; gap: 12px; padding: 20px 16px; border-bottom: 1px solid #334155; }
        .sidebar-nav { flex: 1; padding: 16px 12px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
        .sidebar-link { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; color: #94a3b8; text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: all 0.15s ease; }
        .sidebar-link:hover { background: rgba(255,255,255,0.05); color: white; }
        .sidebar-active { background: #f97316; color: white; font-weight: 700; }
        .sidebar-icon { font-size: 1.2rem; }
        .sidebar-footer { border-top: 1px solid #334155; }

        .admin-header { display: none; }
        .admin-main { flex: 1; margin-left: 260px; padding: 24px; min-height: 100vh; }
        .admin-bottom-nav { display: none; }

        /* Mobile Styles */
        @media (max-width: 1024px) {
          .admin-sidebar { display: none; }
          .admin-main { margin-left: 0; padding: 0; }
        }

        @media (max-width: 768px) {
          .admin-header { 
            display: flex !important; 
            align-items: center; 
            justify-content: space-between; 
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); 
            padding: 12px 16px; 
            padding-top: calc(12px + env(safe-area-inset-top,0px)); 
            position: sticky; top: 0; z-index: 50; 
          }
          .admin-main { padding: 12px; padding-bottom: 80px; }
          
          .admin-bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: 70px;
            background: white;
            border-top: 1px solid #e2e8f0;
            z-index: 50;
            padding-bottom: env(safe-area-inset-bottom, 8px);
            box-shadow: 0 -4px 20px rgba(0,0,0,0.08);
            justify-content: space-around;
            align-items: center;
            overflow-x: auto;
          }
          .admin-nav-item {
            flex: 1;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 2px; text-decoration: none;
            color: #94a3b8; position: relative;
            padding: 8px 4px;
            -webkit-tap-highlight-color: transparent;
            transition: all 0.15s ease;
            min-width: 50px;
          }
          .admin-nav-active { color: #f97316; }
          .admin-nav-icon { font-size: 1.2rem; line-height: 1; }
          .admin-nav-label { font-size: 0.55rem; font-weight: 600; white-space: nowrap; }
          .admin-nav-active .admin-nav-label { font-weight: 700; }
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
          .admin-main { padding: 12px; }
          
          .admin-bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: 70px;
            background: white;
            border-top: 1px solid #e2e8f0;
            z-index: 50;
            padding-bottom: env(safe-area-inset-bottom, 8px);
            box-shadow: 0 -4px 20px rgba(0,0,0,0.08);
            justify-content: space-around;
            align-items: center;
            overflow-x: auto;
          }
          .admin-nav-item {
            flex: 1;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 2px; text-decoration: none;
            color: #94a3b8; position: relative;
            padding: 8px 4px;
            -webkit-tap-highlight-color: transparent;
            transition: all 0.15s ease;
            min-width: 50px;
          }
          .admin-nav-active { color: #f97316; }
          .admin-nav-icon { font-size: 1.2rem; line-height: 1; }
          .admin-nav-label { font-size: 0.55rem; font-weight: 600; white-space: nowrap; }
          .admin-nav-active .admin-nav-label { font-weight: 700; }
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
