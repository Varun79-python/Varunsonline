'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Role = 'customer' | 'shopkeeper' | 'delivery_agent'

const roles = [
  { id: 'customer' as Role, label: 'Customer', icon: '🛍️', desc: 'Browse & order from local shops', color: '#f97316' },
  { id: 'shopkeeper' as Role, label: 'Shop Keeper', icon: '🏪', desc: 'Manage your shop & orders', color: '#0ea5e9' },
  { id: 'delivery_agent' as Role, label: 'Delivery Agent', icon: '🛵', desc: 'Deliver orders & earn', color: '#22c55e' },
]

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [role, setRole] = useState<Role>('customer')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
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
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name, role, phone } }
        })
        if (signUpErr) throw signUpErr
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id, email, full_name: name, phone, role
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

        // Get role from user_metadata first (set at registration — no DB needed)
        let userRole: string = user.user_metadata?.role || ''

        // Fallback: try profiles table
        if (!userRole) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
          userRole = profile?.role || role // final fallback: use the role the user selected on screen
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🛒</div>
        <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '6px' }}>Varun&apos;s Online</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Your favourite local shops, delivered home</p>
      </div>

      {/* Role Selector */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {roles.map(r => (
          <button key={r.id} onClick={() => setRole(r.id)} style={{
            padding: '16px 20px', borderRadius: '14px', cursor: 'pointer',
            border: role === r.id ? `2px solid ${r.color}` : '2px solid var(--border)',
            background: role === r.id ? `${r.color}18` : 'var(--card)',
            color: 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
            minWidth: '130px',
          }}>
            <span style={{ fontSize: '1.8rem' }}>{r.icon}</span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.label}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>{r.desc}</span>
          </button>
        ))}
      </div>

      {/* Form Card */}
      <div className="card" style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Login</button>
          <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Register</button>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px', color: '#fca5a5', fontSize: '0.88rem' }}>{error}</div>}
        {success && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px', color: '#86efac', fontSize: '0.88rem' }}>{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mode === 'register' && (
            <>
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <input className="input" type="text" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Phone Number</label>
                <input className="input" type="tel" placeholder="+91 XXXXX XXXXX" value={phone} onChange={e => setPhone(e.target.value)} required />
              </div>
            </>
          )}
          <div className="input-group">
            <label className="input-label">Email Address</label>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}
            style={{ background: `linear-gradient(135deg, ${selectedRole.color}, ${selectedRole.color}cc)`, boxShadow: `0 4px 20px ${selectedRole.color}40` }}>
            {loading ? <span className="spin" style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} /> : (mode === 'login' ? `Login as ${selectedRole.label}` : `Create ${selectedRole.label} Account`)}
          </button>
        </form>

        {role !== 'customer' && mode === 'register' && (
          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            📋 After registering, you&apos;ll need to upload documents and wait for admin approval.
          </p>
        )}
      </div>

      <p style={{ marginTop: '24px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
        Admin? <a href="/admin/login" style={{ color: 'var(--primary)' }}>Admin Login →</a>
      </p>
    </div>
  )
}
