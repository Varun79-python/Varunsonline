'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Role = 'customer' | 'shopkeeper' | 'delivery_agent'

const roles = [
  { id: 'customer' as Role, label: 'Customer', icon: '🛍️', desc: 'Browse & order', color: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #fb923c)' },
  { id: 'shopkeeper' as Role, label: 'Shop Keeper', icon: '🏪', desc: 'Manage shop', color: '#0ea5e9', gradient: 'linear-gradient(135deg, #0ea5e9, #38bdf8)' },
  { id: 'delivery_agent' as Role, label: 'Delivery Agent', icon: '🛵', desc: 'Deliver & earn', color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #4ade80)' },
]

const GENDER_OPTIONS = [
  { value: '', label: 'Select Gender' },
  { value: 'male', label: '👨 Male' },
  { value: 'female', label: '👩 Female' },
  { value: 'other', label: '🌈 Other' },
  { value: 'prefer_not_to_say', label: '🤐 Prefer not to say' },
}

// Inline SVG icons
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)
const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
)
const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)
const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)
const SuccessIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
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
    <>
      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out forwards;
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        .login-input {
          width: 100%;
          padding: 14px 16px 14px 44px;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          background: #fafbfc;
          font-size: 0.95rem;
          color: #1e293b;
          font-family: inherit;
          transition: all 0.2s ease;
          outline: none;
        }
        .login-input:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }
        .login-input:focus {
          border-color: ${selectedRole.color};
          background: white;
          box-shadow: 0 0 0 3px ${selectedRole.color}18;
        }
        .login-input::placeholder {
          color: #94a3b8;
        }
        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
          transition: color 0.2s ease;
        }
        .input-group:focus-within .input-icon {
          color: ${selectedRole.color};
        }
        .role-card {
          position: relative;
          padding: 14px 16px;
          border-radius: 14px;
          border: 2px solid #e2e8f0;
          background: white;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }
        .role-card:hover {
          border-color: #cbd5e1;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
        }
        .role-card.active {
          border-color: ${selectedRole.color};
          background: ${selectedRole.color}08;
          box-shadow: 0 2px 8px ${selectedRole.color}20;
        }
        .role-card.active .role-check {
          opacity: 1;
          transform: scale(1);
        }
        .role-check {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${selectedRole.color};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: scale(0.5);
          transition: all 0.2s ease;
        }
        .tab-pill {
          flex: 1;
          padding: 10px 0;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: #64748b;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.25s ease;
          position: relative;
          z-index: 1;
          font-family: inherit;
        }
        .tab-pill.active {
          color: #1e293b;
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .tab-container {
          display: flex;
          background: #f1f5f9;
          border-radius: 12px;
          padding: 4px;
          position: relative;
        }
        .btn-primary-premium {
          width: 100%;
          padding: 14px 24px;
          border-radius: 14px;
          border: none;
          color: white;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          position: relative;
          overflow: hidden;
        }
        .btn-primary-premium:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 25px ${selectedRole.color}50;
        }
        .btn-primary-premium:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn-primary-premium:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .spinner {
          width: 18px;
          height: 18px;
          border: 2.5px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .alert-box {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 0.85rem;
          line-height: 1.5;
          animation: fadeInUp 0.3s ease;
        }
        .link-hover {
          position: relative;
          text-decoration: none;
          transition: color 0.2s;
        }
        .link-hover::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 2px;
          background: currentColor;
          transition: width 0.2s ease;
          border-radius: 1px;
        }
        .link-hover:hover::after {
          width: 100%;
        }
        .gender-select {
          width: 100%;
          padding: 14px 16px 14px 44px;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          background: #fafbfc;
          font-size: 0.95rem;
          color: #1e293b;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
          outline: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 16px center;
        }
        .gender-select:hover {
          border-color: #cbd5e1;
        }
        .gender-select:focus {
          border-color: ${selectedRole.color};
          background: white;
          box-shadow: 0 0 0 3px ${selectedRole.color}18;
        }
        .gender-select:invalid, .gender-select option:first-child {
          color: #94a3b8;
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #faf8f5 0%, #fff7ed 50%, #faf8f5 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}>
        
        {/* Main Card */}
        <div className="animate-fade-in-up" style={{
          width: '100%',
          maxWidth: '440px',
          background: 'white',
          borderRadius: '24px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 10px 40px -10px rgba(249,115,22,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}>
          
          {/* Top accent bar */}
          <div style={{
            height: '4px',
            background: selectedRole.gradient,
            transition: 'background 0.3s ease',
          }} />

          <div style={{ padding: '32px 28px 28px' }}>
            
            {/* Logo + Brand */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                position: 'relative',
                width: 96,
                height: 96,
                margin: '0 auto 16px',
              }}>
                {/* Animated ring */}
                <div style={{
                  position: 'absolute',
                  inset: '-4px',
                  borderRadius: '22px',
                  background: selectedRole.gradient,
                  opacity: 0.15,
                  transition: 'all 0.3s ease',
                }} />
                <div style={{
                  position: 'absolute',
                  inset: '-4px',
                  borderRadius: '22px',
                  border: `2px solid ${selectedRole.color}30`,
                  transition: 'all 0.3s ease',
                }} />
                
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '20px',
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                  border: '1.5px solid #f1f5f9',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <img 
                    src="/logo.png" 
                    alt="Varun's Online" 
                    style={{ width: '72px', height: '72px', objectFit: 'contain' }}
                    onError={e => { 
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const sibling = target.nextElementSibling as HTMLElement
                      if (sibling) sibling.hidden = false
                    }} 
                  />
                  <span hidden style={{ fontSize: '2.5rem', filter: 'grayscale(0.2)' }}>🛒</span>
                </div>
              </div>

              <h1 style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                margin: '0 0 6px',
                color: '#1e293b',
                letterSpacing: '-0.02em',
              }}>
                Varun&apos;s Online
              </h1>
              <div style={{
                width: '40px',
                height: '3px',
                background: selectedRole.gradient,
                borderRadius: '2px',
                margin: '0 auto 10px',
                transition: 'background 0.3s ease',
              }} />
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>
                Your favourite local shops, delivered home
              </p>
            </div>

            {/* Role Selector */}
            <div style={{ marginBottom: '24px' }}>
              <p style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '12px',
                paddingLeft: '4px',
              }}>
                I am a
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                {roles.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={`role-card ${role === r.id ? 'active' : ''}`}
                    aria-pressed={role === r.id}
                  >
                    <div className="role-check">
                      <CheckIcon />
                    </div>
                    <span style={{ fontSize: '1.6rem', lineHeight: 1, filter: role === r.id ? 'none' : 'grayscale(0.3)' }}>
                      {r.icon}
                    </span>
                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: role === r.id ? r.color : '#334155',
                        transition: 'color 0.2s',
                        whiteSpace: 'nowrap',
                      }}>
                        {r.label}
                      </div>
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {r.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="tab-container" style={{ marginBottom: '24px' }}>
              <button
                className={`tab-pill ${mode === 'login' ? 'active' : ''}`}
                onClick={() => setMode('login')}
              >
                Login
              </button>
              <button
                className={`tab-pill ${mode === 'register' ? 'active' : ''}`}
                onClick={() => setMode('register')}
              >
                Register
              </button>
            </div>

            {/* Alerts */}
            {error && (
              <div className="alert-box animate-shake" style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                marginBottom: '16px',
              }}>
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="alert-box" style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#16a34a',
                marginBottom: '16px',
              }}>
                <SuccessIcon />
                <span>{success}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {mode === 'register' && (
                <>
                  <div className="input-group" style={{ position: 'relative' }}>
                    <div className="input-icon"><UserIcon /></div>
                    <input
                      className="login-input"
                      type="text"
                      placeholder="Full Name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="input-group" style={{ position: 'relative' }}>
                    <div className="input-icon"><PhoneIcon /></div>
                    <input
                      className="login-input"
                      type="tel"
                      placeholder="Phone Number"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <div className="input-group" style={{ position: 'relative' }}>
                <div className="input-icon"><MailIcon /></div>
                <input
                  className="login-input"
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="input-group" style={{ position: 'relative' }}>
                <div className="input-icon"><LockIcon /></div>
                <input
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{ paddingRight: password ? 48 : undefined }}
                />
                {password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: showPassword ? selectedRole.color : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 4,
                      borderRadius: 6,
                      transition: 'all 0.2s',
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                )}
              </div>

              {mode === 'register' && (
                <div className="input-group" style={{ position: 'relative' }}>
                  <div className="input-icon" style={{ left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                    </svg>
                  </div>
                  <select
                    className="gender-select"
                    value={gender}
                    onChange={e => setGender(e.target.value)}
                    required
                  >
                    {GENDER_OPTIONS.map(o => (
                      <option key={o.value} value={o.value} disabled={o.value === ''} style={{ color: '#1e293b' }}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginTop: '4px' }}>
                <button
                  className="btn-primary-premium"
                  type="submit"
                  disabled={loading}
                  style={{
                    background: selectedRole.gradient,
                    boxShadow: `0 4px 16px ${selectedRole.color}40`,
                  }}
                >
                  {loading ? (
                    <>
                      <div className="spinner" />
                      <span>Please wait...</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Role-specific notice */}
            {role !== 'customer' && mode === 'register' && (
              <div style={{
                marginTop: '16px',
                padding: '12px 14px',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}>
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>📋</span>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
                  After registering, you&apos;ll need to upload documents and wait for admin approval.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Links */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          marginTop: '24px',
        }}>
          {mode === 'login' && (
            <a
              href="/forgot-password"
              className="link-hover"
              style={{
                fontSize: '0.88rem',
                color: selectedRole.color,
                fontWeight: 600,
              }}
            >
              Forgot Password?
            </a>
          )}
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, fontWeight: 500 }}>
            Admin access?{' '}
            <a
              href="/admin/login"
              className="link-hover"
              style={{ color: '#64748b', fontWeight: 700 }}
            >
              Admin Login →
            </a>
          </p>
        </div>
      </div>
    </>
  )
}
