'use client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface RoleCard {
  id: string
  label: string
  desc: string
  icon: string
  color: string
  bgColor: string
  href: string
}

const roles: RoleCard[] = [
  {
    id: 'customer',
    label: 'Customer',
    desc: 'Shop from local stores',
    icon: '🛒',
    color: '#f97316',
    bgColor: '#fff7ed',
    href: '/login/customer',
  },
  {
    id: 'delivery',
    label: 'Delivery Partner',
    desc: 'Deliver & earn',
    icon: '🛵',
    color: '#22c55e',
    bgColor: '#f0fdf4',
    href: '/login/delivery',
  },
  {
    id: 'shopkeeper',
    label: 'Shop Owner',
    desc: 'Make Your Business Online',
    icon: '🏪',
    color: '#0ea5e9',
    bgColor: '#f0f9ff',
    href: '/login/shopkeeper',
  },
]

export default function LoginPage() {
  const router = useRouter()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'white',
      padding: '20px 16px 40px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32, paddingTop: 20 }}>
        <Image src="/logo.png" alt="VarunsOnline" width={160} height={160} priority
          style={{ objectFit: 'contain', marginBottom: 16 }}
        />
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Welcome Back</h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Select your role to continue</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400, margin: '0 auto' }}>
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => router.push(role.href)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '18px 20px',
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: role.bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
              flexShrink: 0,
            }}>
              {role.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', marginBottom: 2 }}>{role.label}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{role.desc}</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
          By continuing, you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  )
}
