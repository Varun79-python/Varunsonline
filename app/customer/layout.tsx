'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

const navItems = [
  { href: '/customer', icon: '🏠', label: 'Home' },
  { href: '/customer/orders', icon: '📦', label: 'Orders' },
  { href: '/customer/cart', icon: '🛒', label: 'Cart' },
  { href: '/customer/profile', icon: '👤', label: 'Profile' },
]

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [cartCount, setCartCount] = useState(0)
  const [cartTotal, setCartTotal] = useState(0)

  const refreshCart = useCallback(() => {
    try {
      const cart: { price: number; quantity: number }[] = JSON.parse(localStorage.getItem('vo_cart') || '[]')
      setCartCount(cart.reduce((s, i) => s + i.quantity, 0))
      setCartTotal(cart.reduce((s, i) => s + i.price * i.quantity, 0))
    } catch { setCartCount(0); setCartTotal(0) }
  }, [])

  useEffect(() => {
    refreshCart()
    window.addEventListener('storage', refreshCart)
    const interval = setInterval(refreshCart, 1500)
    return () => { window.removeEventListener('storage', refreshCart); clearInterval(interval) }
  }, [refreshCart])

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const metaRole = user.user_metadata?.role
      if (metaRole && metaRole !== 'customer') { router.replace('/login'); return }
      if (metaRole === 'customer') { setChecking(false); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile && profile.role !== 'customer') { router.replace('/login'); return }
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
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div className="app-layout">
      {/* Desktop sidebar */}
      <Sidebar navItems={navItems} brandIcon="🛒" brand="Varun's Online" />

      <div className="main-content">
        {/* Desktop topbar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>🛒</span>
            <span style={{ fontWeight: 700 }}>Customer Portal</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            Logout →
          </button>
        </div>

        {/* Page content */}
        <div className="cust-page-wrap">
          {children}
        </div>
      </div>

      {/* ===== MOBILE BOTTOM BARS ===== */}

      {/* Cart summary bar — sits above bottom nav */}
      {cartCount > 0 && (
        <div
          onClick={() => router.push('/customer/cart')}
          className="mobile-cart-bar"
        >
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            🛒 {cartCount} item{cartCount !== 1 ? 's' : ''} · ₹{cartTotal.toFixed(0)}
          </span>
          <span style={{ fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            View Cart →
          </span>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav className="mobile-bottom-nav">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/customer' && pathname.startsWith(item.href))
          return (
            <a
              key={item.href}
              href={item.href}
              className={`mob-nav-item${isActive ? ' mob-nav-active' : ''}`}
            >
              <span className="mob-nav-icon">{item.icon}</span>
              <span className="mob-nav-label">{item.label}</span>
              {/* Cart badge */}
              {item.label === 'Cart' && cartCount > 0 && (
                <span className="mob-nav-badge">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
              {/* Active indicator pill */}
              {isActive && <span className="mob-nav-pip" />}
            </a>
          )
        })}
      </nav>

      <style>{`
        /* ── Mobile-only components hidden on desktop ── */
        .mobile-cart-bar { display: none; }
        .mobile-bottom-nav { display: none; }

        /* ── Desktop: page wrap with standard padding ── */
        .cust-page-wrap { padding-bottom: 24px; }

        /* ══════════════════════════════════════════════
           MOBILE  ≤ 768px
        ══════════════════════════════════════════════ */
        @media (max-width: 768px) {
          .main-content { margin-left: 0 !important; }
          .sidebar { display: none; }
          .topbar { display: none; }
          .page-content { padding: 0 !important; }

          /* Page content: no side padding (pages manage their own),
             bottom padding = nav (60px) + cart bar (52px) + safe-area */
          .cust-page-wrap {
            padding-bottom: calc(${cartCount > 0 ? '112px' : '60px'} + env(safe-area-inset-bottom, 0px));
          }

          /* ── Cart bar ── */
          .mobile-cart-bar {
            display: flex !important;
            position: fixed;
            bottom: calc(60px + env(safe-area-inset-bottom, 0px));
            left: 0; right: 0;
            height: 52px;
            background: #f97316;
            color: white;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            z-index: 49;
            cursor: pointer;
            box-shadow: 0 -2px 12px rgba(249,115,22,0.3);
            touch-action: manipulation;
          }

          /* ── Bottom nav ── */
          .mobile-bottom-nav {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: calc(60px + env(safe-area-inset-bottom, 0px));
            background: white;
            border-top: 1px solid #f1f5f9;
            z-index: 50;
            box-shadow: 0 -1px 0 #e2e8f0, 0 -4px 16px rgba(0,0,0,0.06);
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }

          /* ── Nav items ── */
          .mob-nav-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            text-decoration: none;
            color: #94a3b8;
            position: relative;
            min-height: 60px;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            transition: color 0.12s;
          }
          .mob-nav-item.mob-nav-active { color: #f97316; }

          .mob-nav-icon { font-size: 1.4rem; line-height: 1; }
          .mob-nav-label { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.2px; }
          .mob-nav-active .mob-nav-label { font-weight: 700; }

          /* Active indicator — pill at top of item */
          .mob-nav-pip {
            position: absolute;
            top: 0;
            width: 24px; height: 3px;
            background: #f97316;
            border-radius: 0 0 4px 4px;
          }

          /* Cart badge */
          .mob-nav-badge {
            position: absolute;
            top: 7px;
            right: calc(50% - 16px);
            background: #f97316;
            color: white;
            font-size: 0.55rem;
            font-weight: 800;
            min-width: 16px;
            height: 16px;
            border-radius: 99px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            padding: 0 2px;
          }
        }

        /* ── Very small phones (≤360px width) ── */
        @media (max-width: 360px) {
          .mob-nav-icon { font-size: 1.2rem; }
          .mob-nav-label { font-size: 0.58rem; }
        }
      `}</style>
    </div>
  )
}
