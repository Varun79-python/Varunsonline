'use client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'motion/react'
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

/* ─── Animation variants ────────────────────────────────────────────── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] as const },
  },
}

/* ─── Page ─────────────────────────────────────────────────────────── */

export default function LoginPage() {
  const router = useRouter()

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
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
          style={{ textAlign: 'center', marginBottom: 36 }}
        >
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
        </motion.div>

        {/* ── Role cards ─────────────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          role="list"
          aria-label="Available roles"
        >
          {roles.map((role) => {
            const Icon = role.icon
            return (
              <motion.button
                key={role.id}
                variants={cardVariants}
                onClick={() => router.push(role.href)}
                role="listitem"
                aria-label={`Continue as ${role.label}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '18px 20px',
                  background: '#ffffff',
                  border: '1.5px solid var(--border, #e2e8f0)',
                  borderRadius: 'var(--radius, 14px)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  boxShadow: 'var(--shadow, 0 2px 12px rgba(0,0,0,0.08))',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  outlineOffset: 2,
                }}
                whileHover={{
                  y: -3,
                  boxShadow: 'var(--shadow-md, 0 4px 24px rgba(0,0,0,0.1))',
                  borderColor: role.color,
                  transition: { duration: 0.2, ease: 'easeOut' },
                }}
                whileTap={{ scale: 0.98 }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = role.color
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${role.color}22`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border, #e2e8f0)'
                  e.currentTarget.style.boxShadow = 'var(--shadow, 0 2px 12px rgba(0,0,0,0.08))'
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 'var(--radius-sm, 8px)',
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
              </motion.button>
            )
          })}
        </motion.div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.85 }}
          style={{ textAlign: 'center', marginTop: 36 }}
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
                color: 'var(--primary, #f97316)',
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
                color: 'var(--primary, #f97316)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Privacy Policy
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
