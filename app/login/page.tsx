'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Role = 'customer' | 'shopkeeper' | 'delivery_agent'

const roles = [
  {
    id: 'customer' as Role,
    label: 'Customer',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
    desc: 'Browse & order from local shops',
    color: '#f97316',
    bgColor: '#fff7ed',
    borderColor: '#fed7aa'
  },
  {
    id: 'shopkeeper' as Role,
    label: 'Shop Keeper',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    desc: 'Manage your shop & orders',
    color: '#0ea5e9',
    bgColor: '#f0f9ff',
    borderColor: '#bae6fd'
  },
  {
    id: 'delivery_agent' as Role,
    label: 'Delivery Partner',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
    desc: 'Deliver orders & earn',
    color: '#22c55e',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0'
  },
]

const GENDER_OPTIONS = [
  { value: '', label: 'Select Gender' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)
const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
)
const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)
const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)
const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)
const UserCheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <polyline points="17 11 19 13 23 9" />
  </svg>
)

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [role, setRole] = useState<Role>('customer')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const dashboardRoute: Record<Role, string> = {
    customer: '/customer',
    shopkeeper: '/shopkeeper',
    delivery_agent: '/delivery',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'register') {
        if (!gender) { setError('Please select your gender'); setLoading(false); return }
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name, role, phone, gender } }
        })
        if (signUpErr) throw signUpErr
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id, email, full_name: name, phone, role, gender
          })
          if (role === 'delivery_agent') {
            await supabase.from('delivery_agents').upsert({ id: data.user.id })
          }
          setSuccess('Account created! Check your email to verify, then log in.')
          setMode('login')
        }
      } else {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) throw signInErr
        const user = data.user
        let userRole: string = user.user_metadata?.role || ''
        if (!userRole) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
          userRole = profile?.role || role
        }
        if (userRole === 'admin') { router.push('/admin'); return }
        router.push(dashboardRoute[userRole as Role] || dashboardRoute[role])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const selectedRole = roles.find(r => r.id === role)!

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #fff 0%, #fff7ed 50%, #ffedd5 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px 40px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decorative elements */}
      <div style={{
        position: 'absolute',
        top: '-100px',
        right: '-100px',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-50px',
        left: '-50px',
        width: '200px',
        height: '200px',
        background: 'radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* Logo + Brand */}
      <div style={{
        textAlign: 'center',
        marginBottom: '32px',
        animation: 'fadeInUp 0.5s ease-out',
      }}>
        <div style={{
          width: '90px',
          height: '90px',
          borderRadius: '24px',
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 8px 32px rgba(249,115,22,0.2), 0 2px 8px rgba(0,0,0,0.08)',
          border: '2px solid #fed7aa',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <img
            src="/logo.png"
            alt="Varun's Online"
            style={{ width: '70px', height: '70px', objectFit: 'contain' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('hidden');
            }}
          />
          <span hidden style={{ fontSize: '2.5rem' }}>🛒</span>
        </div>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          margin: '0 0 8px',
          color: '#0f172a',
          letterSpacing: '-0.02em',
        }}>
          Varun&apos;s <span style={{ color: '#f97316' }}>Online</span>
        </h1>
        <p style={{
          color: '#64748b',
          fontSize: '0.875rem',
          margin: 0,
          fontWeight: 500,
        }}>
          Your favorite local shops, delivered home 🚀
        </p>
      </div>

      {/* Form Card - Premium Design */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'white',
        borderRadius: '24px',
        padding: '24px 20px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 12px 48px rgba(249,115,22,0.08)',
        border: '1px solid #f1f5f9',
        animation: 'fadeInUp 0.5s ease-out 0.1s backwards',
      }}>
        {/* Premium Segmented Tabs */}
        <div style={{
          display: 'flex',
          background: '#f8fafc',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '24px',
          position: 'relative',
        }}>
          {/* Sliding indicator */}
          <div style={{
            position: 'absolute',
            top: '4px',
            left: '4px',
            width: 'calc(50% - 4px)',
            height: 'calc(100% - 8px)',
            background: 'white',
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'transform 0.25s ease',
            transform: mode === 'login' ? 'translateX(0)' : 'translateX(100%)',
          }} />
          <button
            onClick={() => setMode('login')}
            style={{
              flex: 1,
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: mode === 'login' ? '#f97316' : '#64748b',
              transition: 'color 0.2s',
              position: 'relative',
              zIndex: 1,
              fontFamily: 'inherit',
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode('register')}
            style={{
              flex: 1,
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: mode === 'register' ? '#f97316' : '#64748b',
              transition: 'color 0.2s',
              position: 'relative',
              zIndex: 1,
              fontFamily: 'inherit',
            }}
          >
            Register
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#dc2626',
            fontSize: '0.85rem',
            fontWeight: 500,
            animation: 'fadeIn 0.3s ease',
          }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#16a34a',
            fontSize: '0.85rem',
            fontWeight: 500,
            animation: 'fadeIn 0.3s ease',
          }}>
            {success}
          </div>
        )}

        {/* Role Selection - Premium Cards */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#64748b',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            I want to continue as
          </label>
          <div style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  border: role === r.id ? `2px solid ${r.color}` : '2px solid #e2e8f0',
                  background: role === r.id ? r.bgColor : 'white',
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  minWidth: '100px',
                  flex: '1 1 calc(33.33% - 8px)',
                  maxWidth: '120px',
                  boxShadow: role === r.id ? `0 4px 16px ${r.color}30` : '0 2px 8px rgba(0,0,0,0.04)',
                  transform: role === r.id ? 'translateY(-2px)' : 'none',
                }}
              >
                <div style={{
                  color: role === r.id ? r.color : '#64748b',
                  transition: 'color 0.2s',
                }}>
                  {r.icon}
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.75rem', color: role === r.id ? '#0f172a' : '#64748b' }}>
                  {r.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mode === 'register' && (
            <>
              {/* Full Name */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: name ? '#f97316' : '#94a3b8',
                  transition: 'color 0.2s',
                  zIndex: 1,
                }}>
                  <UserIcon />
                </div>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '14px 14px 14px 44px',
                    borderRadius: '12px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    background: '#f8fafc',
                    color: '#0f172a',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f97316'
                    e.target.style.background = 'white'
                    e.target.style.boxShadow = '0 0 0 4px rgba(249,115,22,0.1)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0'
                    e.target.style.background = '#f8fafc'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>

              {/* Phone */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: phone ? '#f97316' : '#94a3b8',
                  transition: 'color 0.2s',
                  zIndex: 1,
                }}>
                  <PhoneIcon />
                </div>
                <input
                  type="tel"
                  placeholder="Phone Number (+91)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '14px 14px 14px 44px',
                    borderRadius: '12px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    background: '#f8fafc',
                    color: '#0f172a',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f97316'
                    e.target.style.background = 'white'
                    e.target.style.boxShadow = '0 0 0 4px rgba(249,115,22,0.1)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0'
                    e.target.style.background = '#f8fafc'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
            </>
          )}

          {/* Email */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: email ? '#f97316' : '#94a3b8',
              transition: 'color 0.2s',
              zIndex: 1,
            }}>
              <MailIcon />
            </div>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 14px 14px 44px',
                borderRadius: '12px',
                border: '1.5px solid #e2e8f0',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                background: '#f8fafc',
                color: '#0f172a',
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#f97316'
                e.target.style.background = 'white'
                e.target.style.boxShadow = '0 0 0 4px rgba(249,115,22,0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0'
                e.target.style.background = '#f8fafc'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Password */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: password ? '#f97316' : '#94a3b8',
              transition: 'color 0.2s',
              zIndex: 1,
            }}>
              <LockIcon />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '14px 44px 14px 44px',
                borderRadius: '12px',
                border: '1.5px solid #e2e8f0',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                background: '#f8fafc',
                color: '#0f172a',
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#f97316'
                e.target.style.background = 'white'
                e.target.style.boxShadow = '0 0 0 4px rgba(249,115,22,0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0'
                e.target.style.background = '#f8fafc'
                e.target.style.boxShadow = 'none'
              }}
            />
            {password && (
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#f97316'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            )}
          </div>

          {/* Gender - Register only */}
          {mode === 'register' && (
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: gender ? '#f97316' : '#94a3b8',
                transition: 'color 0.2s',
                zIndex: 1,
              }}>
                <UserCheckIcon />
              </div>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '14px 14px 14px 44px',
                  borderRadius: '12px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  background: '#f8fafc',
                  color: gender ? '#0f172a' : '#94a3b8',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 14px center',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#f97316'
                  e.target.style.background = 'white'
                  e.target.style.boxShadow = '0 0 0 4px rgba(249,115,22,0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0'
                  e.target.style.background = '#f8fafc'
                  e.target.style.boxShadow = 'none'
                }}
              >
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.value === ''}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* CTA Button - Premium */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px 24px',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 16px rgba(249,115,22,0.35), 0 2px 4px rgba(249,115,22,0.2)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '8px',
              opacity: loading ? 0.7 : 1,
              transform: 'translateY(0)',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(249,115,22,0.45), 0 4px 8px rgba(249,115,22,0.3)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(249,115,22,0.35), 0 2px 4px rgba(249,115,22,0.2)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
            onMouseDown={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0) scale(0.98)'
              }
            }}
            onMouseUp={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)'
              }
            }}
          >
            {loading ? (
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              mode === 'login' ? `Continue as ${selectedRole.label}` : `Create ${selectedRole.label} Account`
            )}
          </button>
        </form>

        {/* Additional info */}
        {role !== 'customer' && mode === 'register' && (
          <div style={{
            textAlign: 'center',
            marginTop: '16px',
            fontSize: '0.75rem',
            color: '#64748b',
            padding: '12px',
            background: '#f8fafc',
            borderRadius: '10px',
          }}>
            📋 After registering, you&apos;ll need to upload documents and wait for admin approval.
          </div>
        )}
      </div>

      {/* Footer Links */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        marginTop: '24px',
        animation: 'fadeInUp 0.5s ease-out 0.2s backwards',
      }}>
        {mode === 'login' && (
          <a
            href="/forgot-password"
            style={{
              fontSize: '0.875rem',
              color: '#f97316',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Forgot Password?
          </a>
        )}
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
          Admin? <a href="/admin/login" style={{ color: '#f97316', fontWeight: 600, textDecoration: 'none' }}>Admin Login</a>
        </p>
      </div>

      {/* Global styles for animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { 
            opacity: 0; 
            transform: translateY(20px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  )
}