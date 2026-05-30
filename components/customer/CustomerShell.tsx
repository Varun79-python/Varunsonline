'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import CustomerLocationBar from '@/components/shared/CustomerLocationBar'

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const OrdersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
)
const CartIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
)
const ProfileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const SearchIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const navItems = [
  { href: '/customer', icon: HomeIcon, label: 'Home' },
  { href: '/customer/browse', icon: SearchIcon, label: 'Search' },
  { href: '/customer/orders', icon: OrdersIcon, label: 'Orders' },
  { href: '/customer/cart', icon: CartIcon, label: 'Cart' },
  { href: '/customer/profile', icon: ProfileIcon, label: 'Profile' },
]

export default function CustomerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [cartCount, setCartCount] = useState(0)
  const [cartTotal, setCartTotal] = useState(0)
  const refreshTimer = useRef<NodeJS.Timeout | null>(null)

  const refreshCart = useCallback(() => {
    try {
      const cart: { price: number; quantity: number }[] = JSON.parse(localStorage.getItem('vo_cart') || '[]')
      setCartCount(cart.reduce((s, i) => s + i.quantity, 0))
      setCartTotal(cart.reduce((s, i) => s + i.price * i.quantity, 0))
    } catch { setCartCount(0); setCartTotal(0) }
  }, [])

  useEffect(() => {
    refreshCart()
    const handleStorage = () => refreshCart()
    window.addEventListener('storage', handleStorage)
    refreshTimer.current = setInterval(refreshCart, 1500)
    return () => {
      window.removeEventListener('storage', handleStorage)
      if (refreshTimer.current) clearInterval(refreshTimer.current)
    }
  }, [refreshCart])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="app-layout">
      <Sidebar navItems={[
        { href: '/customer', icon: '🏠', label: 'Home' },
        { href: '/customer/browse', icon: '🔍', label: 'Browse' },
        { href: '/customer/orders', icon: '📦', label: 'My Orders' },
        { href: '/customer/cart', icon: '🛒', label: 'Cart' },
        { href: '/customer/profile', icon: '👤', label: 'Profile' },
      ]} brandIcon="🛒" brand="Varun's Online" />

        <div className="main-content">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>🛒</span>
            <span style={{ fontWeight: 700 }}>Customer Portal</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            Logout →
          </button>
        </div>

        <CustomerLocationBar />

        <div style={{ paddingBottom: cartCount > 0 ? 130 : 74 }}>
          {children}
        </div>
      </div>

      {cartCount > 0 && pathname !== '/customer/cart' && (
        <div
          onClick={() => router.push('/customer/cart')}
          style={{
            position: 'fixed', bottom: 68, left: 4, right: 4, height: 52,
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            color: 'white', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '0 16px',
            zIndex: 49, cursor: 'pointer', borderRadius: '14px',
            boxShadow: '0 -4px 20px rgba(249,115,22,0.35)',
            marginBottom: 'env(safe-area-inset-bottom)',
          }}
          className="mobile-cart-bar"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: '1rem' }}>₹{cartTotal.toFixed(0)}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
      )}

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 68, background: 'white', borderTop: '1px solid #f1f5f9', display: 'flex', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -4px 20px rgba(0,0,0,0.04)' }} className="mobile-bottom-nav">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/customer' && pathname.startsWith(item.href))
          const IconComponent = item.icon
          return (
            <a key={item.href} href={item.href} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textDecoration: 'none', color: isActive ? '#f97316' : '#94a3b8', fontSize: '0.65rem', fontWeight: isActive ? 600 : 500, position: 'relative', transition: 'all 0.2s ease', background: isActive ? 'rgba(249,115,22,0.06)' : 'transparent' }}>
              <div style={{ position: 'absolute', top: 8, width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'transparent', color: isActive ? 'white' : 'inherit', transition: 'all 0.2s ease', transform: isActive ? 'scale(1)' : 'scale(0.9)', boxShadow: isActive ? '0 4px 12px rgba(249,115,22,0.35)' : 'none' }}>
                <IconComponent />
              </div>
              <span style={{ marginTop: 36, color: isActive ? '#f97316' : '#94a3b8', fontWeight: isActive ? 600 : 500 }}>
                {item.label}
              </span>
              {item.label === 'Cart' && cartCount > 0 && (
                <span style={{ position: 'absolute', top: 6, right: '50%', transform: 'translateX(70%)', background: '#f97316', color: 'white', fontSize: '0.6rem', fontWeight: 800, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', boxShadow: '0 2px 8px rgba(249,115,22,0.4)' }}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </a>
          )
        })}
      </nav>

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
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}