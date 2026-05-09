'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

const navItems = [
  { href: '/customer', icon: '🏠', label: 'Home' },
  { href: '/customer/orders', icon: '📦', label: 'My Orders' },
  { href: '/customer/cart', icon: '🛒', label: 'Cart' },
  { href: '/customer/profile', icon: '👤', label: 'Profile' },
]

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      // Check user_metadata first (no DB required)
      const metaRole = user.user_metadata?.role
      if (metaRole && metaRole !== 'customer') { router.replace('/login'); return }
      if (metaRole === 'customer') { setChecking(false); return }

      // Fallback: profiles table
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile && profile.role !== 'customer') { router.replace('/login'); return }

      // If no profile yet (schema not run), allow access — role was selected at login
      setChecking(false)
    }
    checkAuth()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar navItems={navItems} brandIcon="🛒" brand="Varun's Online" />
      <div className="main-content">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>🛒</span>
            <span style={{ fontWeight: 700 }}>Customer Portal</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>Logout →</button>
        </div>
        <div className="page-content">{children}</div>
      </div>
      <nav className="bottom-nav" style={{ display: 'flex' }}>
        {navItems.map(item => (
          <a key={item.href} href={item.href} className="bottom-nav-item">
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
