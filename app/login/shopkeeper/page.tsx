'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ShopkeeperLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', shop_name: '', phone: '' })
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/shopkeeper')
    } else {
      router.push('/shopkeeper/register')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <img src="/logo.png" alt="VarunsOnline" style={{ width: 40, height: 40, objectFit: 'contain' }} />
      </div>

      <div style={{ flex: 1, padding: '0 24px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '2rem' }}>🏪</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{isLogin ? 'Shop Owner' : 'Register Your Shop'}</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{isLogin ? 'Sign in to manage your shop' : 'Start selling on VarunsOnline'}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required style={{ padding: '14px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white' }} />
          <input type="password" placeholder="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required style={{ padding: '14px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white' }} />

          {error && <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: 10, color: '#dc2626', fontSize: '0.85rem', fontWeight: 500 }}>{error}</div>}

          <button type="submit" disabled={loading} style={{ padding: '16px', background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: 'white', border: 'none', borderRadius: 14, fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 16px rgba(14,165,233,0.3)' }}>
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Register Shop')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{isLogin ? "Want to list your shop?" : 'Already have a shop?'} </span>
          <button onClick={() => { setIsLogin(!isLogin); setError('') }} style={{ background: 'none', border: 'none', color: '#0ea5e9', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>{isLogin ? 'Register' : 'Login'}</button>
        </div>
      </div>
    </div>
  )
}