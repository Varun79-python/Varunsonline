'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [userType, setUserType] = useState<'shopkeeper' | 'agent' | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    password: '',
    gender: '',
  })

  async function handleSubmit() {
    if (!userType) { alert('Please select Register as Shopkeeper or Agent'); return }
    if (!form.full_name.trim()) { alert('Please enter Full Name'); return }
    if (!form.phone_number.trim()) { alert('Please enter Phone Number'); return }
    if (!form.email.trim()) { alert('Please enter Email'); return }
    if (!form.password.trim()) { alert('Please enter Password'); return }
    if (form.password.length < 6) { alert('Password must be at least 6 characters'); return }
    if (!form.gender) { alert('Please select Gender'); return }

    setSaving(true)

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { 
          data: { 
            full_name: form.full_name.trim(), 
            role: userType,
            phone: form.phone_number.trim(),
            gender: form.gender
          } 
        }
      })

      if (signUpError) { 
        alert('Registration failed: ' + signUpError.message); 
        setSaving(false); 
        return 
      }

      if (!signUpData.user) { 
        alert('Failed to create account'); 
        setSaving(false); 
        return 
      }

      // Save basic info to profiles table
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: form.full_name.trim(),
        phone: form.phone_number.trim(),
        email: form.email.trim(),
        gender: form.gender
      }).eq('id', signUpData.user.id)

      if (profileError) {
        console.error('Profile update error:', profileError)
      }

      // Store user type in localStorage for next step
      localStorage.setItem('registration_user_type', userType)
      localStorage.setItem('registration_user_id', signUpData.user.id)

      setSaving(false)
      router.push('/register-documents')
    } catch (err: any) {
      alert('Error: ' + err.message)
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📝</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Create Account</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Register as a Shopkeeper or Delivery Agent</p>
        </div>

        {/* Progress Steps */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32, gap: 8 }}>
          <div style={{ width: 40, height: 6, borderRadius: 3, background: step >= 1 ? '#f97316' : '#e2e8f0' }} />
          <div style={{ width: 40, height: 6, borderRadius: 3, background: step >= 2 ? '#f97316' : '#e2e8f0' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, padding: '0 20px' }}>
          <span style={{ fontSize: '0.75rem', color: step >= 1 ? '#f97316' : '#94a3b8', fontWeight: 600 }}>Basic Info</span>
          <span style={{ fontSize: '0.75rem', color: step >= 2 ? '#f97316' : '#94a3b8', fontWeight: 600 }}>Documents</span>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          {/* User Type Selection */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 10 }}>I want to register as *</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setUserType('shopkeeper')}
                style={{ 
                  flex: 1, 
                  padding: 16, 
                  border: userType === 'shopkeeper' ? '2px solid #f97316' : '2px solid #e2e8f0', 
                  borderRadius: 12, 
                  background: userType === 'shopkeeper' ? '#fff7ed' : 'white',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 4 }}>🏪</div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>Shopkeeper</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Start selling</div>
              </button>
              <button
                type="button"
                onClick={() => setUserType('agent')}
                style={{ 
                  flex: 1, 
                  padding: 16, 
                  border: userType === 'agent' ? '2px solid #f97316' : '2px solid #e2e8f0', 
                  borderRadius: 12, 
                  background: userType === 'agent' ? '#fff7ed' : 'white',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 4 }}>🚚</div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>Delivery Agent</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Deliver orders</div>
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Full Name *</label>
              <input 
                value={form.full_name} 
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} 
                placeholder="Enter your full name" 
                style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Phone Number *</label>
              <input 
                value={form.phone_number} 
                onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} 
                placeholder="10-digit mobile number" 
                style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email ID *</label>
              <input 
                value={form.email} 
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
                placeholder="your@email.com" 
                type="email" 
                style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password *</label>
              <input 
                type="password" 
                value={form.password} 
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} 
                placeholder="Create a password (min 6 chars)" 
                style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Gender *</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {['male', 'female', 'other'].map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, gender: g }))}
                    style={{ 
                      flex: 1, 
                      padding: 12, 
                      border: form.gender === g ? '2px solid #f97316' : '1.5px solid #e2e8f0', 
                      borderRadius: 10, 
                      background: form.gender === g ? '#fff7ed' : 'white',
                      cursor: 'pointer',
                      fontWeight: form.gender === g ? 700 : 400,
                      color: form.gender === g ? '#f97316' : '#374151',
                      textTransform: 'capitalize'
                    }}
                  >
                    {g === 'male' ? '👨 Male' : g === 'female' ? '👩 Female' : '⚧ Other'}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={handleSubmit} 
              disabled={saving}
              style={{ padding: 16, background: saving ? '#94a3b8' : '#f97316', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', marginTop: 8 }}
            >
              {saving ? 'Saving...' : 'Save & Continue →'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Already have an account? </span>
          <a href="/login" style={{ color: '#f97316', fontWeight: 700, fontSize: '0.9rem' }}>Login</a>
        </div>
      </div>
    </div>
  )
}