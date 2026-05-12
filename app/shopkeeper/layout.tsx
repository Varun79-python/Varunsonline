'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import { usePushNotifications } from '@/lib/usePushNotifications'

const navItems = [
  { href: '/shopkeeper', icon: '📊', label: 'Dashboard' },
  { href: '/shopkeeper/orders', icon: '🛒', label: 'Orders' },
  { href: '/shopkeeper/products', icon: '🏷️', label: 'Products' },
  { href: '/shopkeeper/wallet', icon: '💰', label: 'Wallet' },
  { href: '/shopkeeper/plans', icon: '📋', label: 'Plan' },
  { href: '/shopkeeper/profile', icon: '🏪', label: 'Profile' },
]

export default function ShopkeeperLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [shopName, setShopName] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  // Register FCM token once user is authenticated
  usePushNotifications(userId)

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (pathname === '/shopkeeper/register') {
        if (user) { router.replace('/shopkeeper'); return }
        setChecking(false); return
      }
      if (!user) { router.replace('/login'); return }
      const metaRole = user.user_metadata?.role
      if (metaRole && metaRole !== 'shopkeeper') { router.replace('/login'); return }
      if (metaRole === 'shopkeeper') {
        setShopName(user.user_metadata?.full_name || 'Shopkeeper')
        setUserId(user.id)
        setChecking(false); return
      }
      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      if (profile && profile.role !== 'shopkeeper') { router.replace('/login'); return }
      setShopName(profile?.full_name || user.user_metadata?.full_name || 'Shopkeeper')
      setUserId(user.id)
      setChecking(false)
    }
    checkAuth()
  }, [pathname])

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
      <Sidebar navItems={navItems} brandIcon="🏪" brand="Shop Dashboard" />
      <div className="main-content">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>🏪</span>
            <div>
              <div style={{ fontWeight: 700, lineHeight: 1.2 }}>Shop Dashboard</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{shopName}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#dc2626', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>Logout →</button>
        </div>
        <div className="sk-page-wrap">{children}</div>
      </div>

      {/* Mobile bottom nav — scrollable for 6 items */}
      <nav className="sk-bottom-nav">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/shopkeeper' && pathname.startsWith(item.href))
          return (
            <a key={item.href} href={item.href} className={`sk-nav-item${isActive ? ' sk-nav-active' : ''}`}>
              {isActive && <span className="sk-nav-pip" />}
              <span className="sk-nav-icon">{item.icon}</span>
              <span className="sk-nav-label">{item.label}</span>
            </a>
          )
        })}
      </nav>

      <style>{`
        .sk-page-wrap { padding-bottom: 24px; }
        .sk-bottom-nav { display: none; }

        @media (max-width: 768px) {
          .sidebar { display: none !important; }
          .topbar  { display: none !important; }
          .main-content { margin-left: 0 !important; }
          .page-content { padding: 0 !important; }

          .sk-page-wrap {
            padding-bottom: calc(62px + env(safe-area-inset-bottom, 0px));
          }

          .sk-bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: calc(62px + env(safe-area-inset-bottom, 0px));
            background: white;
            border-top: 1.5px solid #f1f5f9;
            z-index: 50;
            padding-bottom: env(safe-area-inset-bottom, 0px);
            box-shadow: 0 -2px 16px rgba(0,0,0,0.07);
            /* 6 items: allow horizontal scroll on very small phones */
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-x: contain;
          }
          .sk-bottom-nav::-webkit-scrollbar { display: none; }

          .sk-nav-item {
            flex: 0 0 auto;
            min-width: 58px;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 3px; text-decoration: none;
            color: #94a3b8; position: relative;
            min-height: 62px; padding: 0 6px;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            transition: color 0.12s;
          }
          .sk-nav-active { color: var(--primary); }
          .sk-nav-pip {
            position: absolute; top: 0;
            width: 24px; height: 3px;
            background: var(--primary);
            border-radius: 0 0 4px 4px;
          }
          .sk-nav-icon  { font-size: 1.25rem; line-height: 1; }
          .sk-nav-label { font-size: 0.58rem; font-weight: 600; white-space: nowrap; }
          .sk-nav-active .sk-nav-label { font-weight: 700; }
        }
      `}</style>
    </div>
  )
}
