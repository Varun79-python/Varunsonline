'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

const navItems = [
  { href: '/shopkeeper', icon: '📊', label: 'Dashboard' },
  { href: '/shopkeeper/orders', icon: '🛒', label: 'Orders' },
  { href: '/shopkeeper/products', icon: '🏷️', label: 'Products' },
  { href: '/shopkeeper/wallet', icon: '💰', label: 'Wallet' },
  { href: '/shopkeeper/plans', icon: '📋', label: 'My Plan' },
  { href: '/shopkeeper/profile', icon: '🏪', label: 'Shop Profile' },
]

export default function ShopkeeperLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [shopName, setShopName] = useState('')

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      // Check user_metadata first (no DB required)
      const metaRole = user.user_metadata?.role
      if (metaRole && metaRole !== 'shopkeeper') { router.replace('/login'); return }
      if (metaRole === 'shopkeeper') {
        setShopName(user.user_metadata?.full_name || 'Shopkeeper')
        setChecking(false); return
      }

      // Fallback: profiles table
      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      if (profile && profile.role !== 'shopkeeper') { router.replace('/login'); return }

      setShopName(profile?.full_name || user.user_metadata?.full_name || 'Shopkeeper')
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
      <Sidebar navItems={navItems} brandIcon="🏪" />
      <div className="main-content">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>🏪</span>
            <div>
              <div style={{ fontWeight: 700, lineHeight: 1.2 }}>Shop Dashboard</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{shopName}</div>
            </div>
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
