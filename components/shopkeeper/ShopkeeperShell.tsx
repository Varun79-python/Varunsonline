'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import { usePushNotifications } from '@/lib/usePushNotifications'
import ShopLocationBar from '@/components/shared/ShopLocationBar'

const navItems = [
  { href: '/shopkeeper', icon: '📊', label: 'Dashboard' },
  { href: '/shopkeeper/orders', icon: '🛒', label: 'Orders' },
  { href: '/shopkeeper/products', icon: '🏷️', label: 'Products' },
  { href: '/shopkeeper/wallet', icon: '💰', label: 'Wallet' },
  { href: '/shopkeeper/plans', icon: '📋', label: 'Plan' },
  { href: '/shopkeeper/profile', icon: '🏪', label: 'Profile' },
]

export default function ShopkeeperShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [shopName, setShopName] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  usePushNotifications(userId)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setShopName(user.user_metadata?.full_name || 'Shopkeeper')
        setUserId(user.id)
      }
    }
    loadUser()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
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
        <ShopLocationBar />
        <div className="sk-page-wrap">{children}</div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="sk-bottom-nav">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/shopkeeper' && pathname.startsWith(item.href))
          return (
            <a key={item.href} href={item.href} className={`sk-nav-item${isActive ? ' sk-nav-active' : ''}`}>
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

          .sk-page-wrap { padding-bottom: 80px; }

          .sk-bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: 70px;
            background: white;
            border-top: 1px solid #f1f5f9;
            z-index: 50;
            padding-bottom: env(safe-area-inset-bottom, 8px);
            box-shadow: 0 -4px 20px rgba(0,0,0,0.08);
            justify-content: space-around;
            align-items: center;
          }

          .sk-nav-item {
            flex: 1;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 4px; text-decoration: none;
            color: #94a3b8; position: relative;
            padding: 8px 4px;
            -webkit-tap-highlight-color: transparent;
            transition: all 0.15s ease;
          }
          .sk-nav-active { color: #f97316; }
          .sk-nav-active .sk-nav-icon { transform: scale(1.1); }
          .sk-nav-icon  { font-size: 1.3rem; line-height: 1; transition: transform 0.15s ease; }
          .sk-nav-label { font-size: 0.6rem; font-weight: 600; white-space: nowrap; color: inherit; }
          .sk-nav-active .sk-nav-label { font-weight: 700; }
        }
      `}</style>
    </div>
  )
}