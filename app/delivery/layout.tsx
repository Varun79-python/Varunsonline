'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import { usePushNotifications } from '@/lib/usePushNotifications'

const navItems = [
  { href: '/delivery', icon: '📊', label: 'Dashboard' },
  { href: '/delivery/orders', icon: '📦', label: 'Orders' },
  { href: '/delivery/wallet', icon: '💰', label: 'Wallet' },
  { href: '/delivery/profile', icon: '👤', label: 'Profile' },
]

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [agentName, setAgentName] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  // Register FCM token once user is authenticated
  usePushNotifications(userId)

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (pathname === '/login/delivery/register') {
        if (user) { router.replace('/delivery'); return }
        setChecking(false); return
      }
      if (!user) { setChecking(false); return }
      const metaRole = user.user_metadata?.role
      if (metaRole && metaRole !== 'delivery_agent') { router.replace('/login'); return }
      if (metaRole === 'delivery_agent') {
        setAgentName(user.user_metadata?.full_name || 'Agent')
        setUserId(user.id)
        setChecking(false); return
      }
      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      if (profile && profile.role !== 'delivery_agent') { router.replace('/login'); return }
      setAgentName(profile?.full_name || user.user_metadata?.full_name || 'Agent')
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
        <div style={{ width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar navItems={navItems} brandIcon="🛵" brand="Delivery" />
      <div className="main-content">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>🛵</span>
            <div>
              <div style={{ fontWeight: 700, lineHeight: 1.2 }}>Delivery Partner</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{agentName}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#dc2626', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>Logout →</button>
        </div>
        <div className="dl-page-wrap">{children}</div>
      </div>

{/* Mobile bottom nav */}
      <nav className="dl-bottom-nav">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/delivery' && pathname.startsWith(item.href))
          return (
            <a key={item.href} href={item.href} className={`dl-nav-item${isActive ? ' dl-nav-active' : ''}`}>
              {isActive && <span className="dl-nav-pip" />}
              <span className="dl-nav-icon">{item.icon}</span>
              <span className="dl-nav-label">{item.label}</span>
            </a>
          )
        })}
      </nav>

      <style>{`
        .dl-page-wrap { padding-bottom: 24px; }
        .dl-bottom-nav { display: none; }

        @media (max-width: 768px) {
          .sidebar { display: none !important; }
          .topbar  { display: none !important; }
          .main-content { margin-left: 0 !important; }
          .page-content { padding: 0 !important; }

          .dl-page-wrap {
            padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px));
          }

          .dl-bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: calc(60px + env(safe-area-inset-bottom, 0px));
            background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
            border-top: 1px solid rgba(255,255,255,0.1);
            z-index: 50;
            padding-bottom: env(safe-area-inset-bottom, 0px);
            box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
          }

          .dl-nav-item {
            flex: 1; display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 2px; text-decoration: none;
            color: #64748b; position: relative;
            min-height: 60px;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            transition: all 0.15s;
          }
          .dl-nav-active { color: #22c55e; }
          .dl-nav-pip {
            position: absolute; top: 0;
            width: 28px; height: 3px;
            background: #22c55e;
            border-radius: 0 0 4px 4px;
          }
          .dl-nav-icon  { font-size: 1.3rem; line-height: 1; }
          .dl-nav-label { font-size: 0.6rem; font-weight: 600; }
          .dl-nav-active .dl-nav-label { font-weight: 700; }
        }
        @media (max-width: 360px) {
          .dl-nav-icon { font-size: 1.15rem; }
          .dl-nav-label { font-size: 0.55rem; }
        }
      `}</style>
    </div>
  )
}
