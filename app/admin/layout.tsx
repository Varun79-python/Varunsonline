'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

const navItems = [
  { href: '/admin', icon: '📊', label: 'Dashboard' },
  { href: '/admin/shops', icon: '🏪', label: 'Shops' },
  { href: '/admin/agents', icon: '🛵', label: 'Agents' },
  { href: '/admin/customers', icon: '👥', label: 'Customers' },
  { href: '/admin/orders', icon: '📦', label: 'Orders' },
  { href: '/admin/plans', icon: '📋', label: 'Plans' },
  { href: '/admin/withdrawals', icon: '💸', label: 'Withdrawals' },
  { href: '/admin/agent-settlements', icon: '💳', label: 'Settlements' },
  { href: '/admin/coupons', icon: '🏷️', label: 'Coupons' },
  { href: '/admin/settings', icon: '⚙️', label: 'Settings' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [adminName, setAdminName] = useState('')

  // Skip auth check on the login page itself
  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (isLoginPage) { setChecking(false); return }

    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/admin/login')
        return
      }

      const ADMIN_EMAIL = 'venkatavarun79@gmail.com'

      // Check user_metadata / app_metadata first (no DB required)
      const metaRole = user.user_metadata?.role || user.app_metadata?.role
      if (metaRole === 'admin' || user.email === ADMIN_EMAIL) {
        setAdminName(user.user_metadata?.full_name || user.email || 'Admin')
        setChecking(false)
        return
      }

      // Fallback: check profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        await supabase.auth.signOut()
        router.replace('/admin/login')
        return
      }

      setAdminName(profile.full_name || user.email || 'Admin')
      setChecking(false)
    }

    checkAuth()
  }, [pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  // Show login page without the admin shell
  if (isLoginPage) {
    return <>{children}</>
  }

  // Show full-screen spinner while verifying identity
  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)' }}>Verifying admin access...</p>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar navItems={navItems} brandIcon="👑" brand="Admin Panel" />
      <div className="main-content">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>👑</span>
            <div>
              <div style={{ fontWeight: 700, lineHeight: 1.2 }}>Admin Control Panel</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{adminName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="badge badge-orange">Super Admin</span>
            <button
              onClick={handleLogout}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              Logout →
            </button>
          </div>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  )
}
