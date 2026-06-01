'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { User, Bike, Store, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ─── Types ────────────────────────────────────────────────────────── */

interface RoleCard {
  id: string
  label: string
  desc: string
  icon: LucideIcon
  color: string
  bgColor: string
  href: string
}

/* ─── Data ─────────────────────────────────────────────────────────── */

const roles: RoleCard[] = [
  {
    id: 'customer',
    label: 'Customer',
    desc: 'Shop from local stores',
    icon: User,
    color: '#f97316',
    bgColor: '#fff7ed',
    href: '/login/customer',
  },
  {
    id: 'delivery',
    label: 'Delivery Partner',
    desc: 'Deliver & earn',
    icon: Bike,
    color: '#22c55e',
    bgColor: '#f0fdf4',
    href: '/login/delivery',
  },
  {
    id: 'shopkeeper',
    label: 'Shop Owner',
    desc: 'Make Your Business Online',
    icon: Store,
    color: '#0ea5e9',
    bgColor: '#f0f9ff',
    href: '/login/shopkeeper',
  },
]

/* ─── Page ─────────────────────────────────────────────────────────── */

export default function LoginPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div style={{ minHeight: '100vh', background: '#ffffff' }} />
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#ffffff',
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, #fff7ed 0%, transparent 65%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <style>{`
        @keyframes loginFadeInDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginFadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-header {
          animation: loginFadeInDown 0.45s cubic-bezier(0.32, 0.72, 0, 1) forwards;
        }
        .anim-container {
          animation: loginFadeInUp 0.5s cubic-bezier(0.32, 0.72, 0, 1) 0.1s forwards;
          opacity: 0;
        }
        .role-btn {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 20px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          cursor: pointer;
          text-align: left;
          width: 100%;
          font-family: inherit;
          font-size: inherit;
          box-shadow: 0 2px 12px rgba(0,0,0,0.05);
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.25s ease, box-shadow 0.25s ease;
          outlineOffset: 2;
        }
        .role-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.1);
        }
        .role-btn:active {
          transform: scale(0.98);
        }
      `}</style>

      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="anim-header" style={{ textAlign: 'center', marginBottom: 36 }}>
          <Image
            src="/logo.png"
            alt="VarunsOnline"
            width={120}
            height={120}
            priority
            style={{ objectFit: 'contain', marginBottom: 20 }}
          />
          <h1
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 6px',
              letterSpacing: '-0.02em',
            }}
          >
            Welcome Back
          </h1>
          <p
            style={{
              color: '#64748b',
              fontSize: '0.95rem',
              margin: 0,
            }}
          >
            Select your role to continue
          </p>
        </div>

        {/* ── Role cards ─────────────────────────────────────────── */}
        <div
          className="anim-container"
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          role="list"
          aria-label="Available roles"
        >
          {roles.map((role) => {
            const Icon = role.icon
            return (
              <button
                key={role.id}
                onClick={() => router.push(role.href)}
                className="role-btn"
                role="listitem"
                aria-label={`Continue as ${role.label}`}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = role.color;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${role.color}22`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.05)';
                }}
                style={{
                  '--hover-border': role.color
                } as any}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 8,
                    background: role.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  <Icon size={26} color={role.color} strokeWidth={1.8} />
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '1.05rem',
                      color: '#0f172a',
                      marginBottom: 2,
                    }}
                  >
                    {role.label}
                  </div>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      color: '#64748b',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {role.desc}
                  </div>
                </div>

                {/* Chevron */}
                <ChevronRight
                  size={18}
                  color="#94a3b8"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div
          style={{
            textAlign: 'center',
            marginTop: 36,
            animation: 'loginFadeInUp 0.5s ease 0.2s forwards',
            opacity: 0
          }}
        >
          <p
            style={{
              fontSize: '0.82rem',
              color: '#94a3b8',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            By continuing, you agree to our{' '}
            <a
              href="/terms"
              style={{
                color: '#f97316',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Terms
            </a>
            {' & '}
            <a
              href="/privacy"
              style={{
                color: '#f97316',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

