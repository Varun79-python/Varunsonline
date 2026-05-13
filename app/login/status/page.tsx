'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ApprovalStatusPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<{approved: boolean, role: string, message: string} | null>(null)

  useEffect(() => {
    checkApprovalStatus()
  }, [])

  async function checkApprovalStatus() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // Get user role from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      setStatus({ approved: false, role: 'unknown', message: 'Profile not found. Please contact support.' })
      setLoading(false)
      return
    }

    if (profile.role === 'shopkeeper') {
      const { data: shop } = await supabase
        .from('shops')
        .select('is_approved, is_active, rejection_reason')
        .eq('owner_id', user.id)
        .single()

      if (!shop) {
        setStatus({ approved: false, role: 'shopkeeper', message: 'No shop found. Please complete registration.' })
      } else if (shop.is_approved && shop.is_active) {
        setStatus({ approved: true, role: 'shopkeeper', message: 'Your shop is approved and active!' })
      } else if (shop.is_approved && !shop.is_active) {
        setStatus({ approved: false, role: 'shopkeeper', message: 'Your shop is approved but not yet active. Please contact admin.' })
      } else if (shop.rejection_reason) {
        setStatus({ approved: false, role: 'shopkeeper', message: 'Registration rejected: ' + shop.rejection_reason })
      } else {
        setStatus({ approved: false, role: 'shopkeeper', message: 'Your shop registration is pending admin approval.' })
      }
    } else if (profile.role === 'delivery_agent') {
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('is_approved, is_active, rejection_reason')
        .eq('id', user.id)
        .single()

      if (!agent) {
        setStatus({ approved: false, role: 'delivery_agent', message: 'No agent profile found. Please complete registration.' })
      } else if (agent.is_approved && agent.is_active) {
        setStatus({ approved: true, role: 'delivery_agent', message: 'Your agent account is approved and active!' })
      } else if (agent.is_approved && !agent.is_active) {
        setStatus({ approved: false, role: 'delivery_agent', message: 'Your account is approved but not yet active. Please contact admin.' })
      } else if (agent.rejection_reason) {
        setStatus({ approved: false, role: 'delivery_agent', message: 'Registration rejected: ' + agent.rejection_reason })
      } else {
        setStatus({ approved: false, role: 'delivery_agent', message: 'Your agent registration is pending admin approval.' })
      }
    } else {
      setStatus({ approved: true, role: profile.role, message: 'Your account is active.' })
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 16 }}>⏳</div>
          <p style={{ color: '#64748b' }}>Checking approval status...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 32, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>
            {status?.approved ? '✅' : '⏳'}
          </div>
          
          <h2 style={{ marginBottom: 8, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
            {status?.approved ? 'Approved!' : 'Pending Approval'}
          </h2>
          
          <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
            {status?.message}
          </p>

          {status?.approved ? (
            <button 
              onClick={() => router.push(status.role === 'shopkeeper' ? '/shopkeeper' : '/delivery/orders')}
              style={{ padding: '14px 32px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Go to Dashboard →
            </button>
          ) : (
            <div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>
                Please wait for admin to review your application.<br/>This usually takes 24-48 hours.
              </p>
              <button 
                onClick={() => router.push('/login')}
                style={{ padding: '14px 32px', background: '#f97316', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}