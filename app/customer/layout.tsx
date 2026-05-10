'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
    // Listen for storage changes (from other tabs or same page)
    window.addEventListener('storage', refreshCart)
    // Poll every 1.5s for same-tab updates
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

        {/* Page content — bottom padding accounts for nav + cart bar */}
        <div style={{ paddingBottom: cartCount > 0 ? 130 : 74 }}>
          {children}
        </div>
      </div>

      {/* ===== MOBILE BOTTOM BARS ===== */}

      {/* Cart summary bar — appears ABOVE nav when cart has items */}
      {cartCount > 0 && (
        <div
          onClick={() => router.push('/customer/cart')}
          style={{
            position: 'fixed',
            bottom: 64,
            left: 0, right: 0,
            height: 56,
            background: '#f97316',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            zIndex: 49,
            cursor: 'pointer',
            boxShadow: '0 -3px 16px rgba(249,115,22,0.28)',
            // Only visible on mobile
          }}
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
      <nav
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          height: 64,
          background: 'white',
          borderTop: '1px solid #eee',
          display: 'flex',
          zIndex: 50,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        className="mobile-bottom-nav"
      >
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/customer' && pathname.startsWith(item.href))
          return (
            <a
              key={item.href}
              href={item.href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                textDecoration: 'none',
                color: isActive ? '#f97316' : '#94a3b8',
                fontSize: '0.65rem',
                fontWeight: isActive ? 700 : 500,
                position: 'relative',
                transition: 'color 0.15s',
              }}
            >
              <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{item.icon}</span>
              <span>{item.label}</span>
              {/* Cart badge */}
              {item.label === 'Cart' && cartCount > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: '50%', transform: 'translateX(80%)',
                  background: '#f97316', color: 'white',
                  fontSize: '0.6rem', fontWeight: 800,
                  width: 16, height: 16, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid white',
                }}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
              {/* Active indicator dot */}
              {isActive && (
                <span style={{
                  position: 'absolute', bottom: 2,
                  width: 4, height: 4, borderRadius: '50%', background: '#f97316'
                }} />
              )}
            </a>
          )
        })}
      </nav>

      {/* CSS to control visibility on mobile vs desktop */}
      <style>{`
        .mobile-cart-bar { display: none; }
        .mobile-bottom-nav { display: none; }
        @media (max-width: 768px) {
          .mobile-cart-bar { display: flex !important; }
          .mobile-bottom-nav { display: flex !important; }
          .main-content { margin-left: 0 !important; }
          .sidebar { display: none; }
          .topbar { display: none; }
          .page-content { padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}
