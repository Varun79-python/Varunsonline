'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ApprovalStatusPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<{approved: boolean, role: string, message: string, needsRegistration?: boolean, redirectUrl?: string} | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const checkApprovalStatus = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!mountedRef.current) return

    if (!user) {
      router.push('/login')
      return
    }

    // Get user role from profile — fast single query
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!mountedRef.current) return

    if (!profile) {
      setStatus({ approved: false, role: 'unknown', message: 'Profile not found. Please contact support.' })
      setLoading(false)
      return
    }

    if (profile.role === 'shopkeeper') {
      // Check shop status directly — single query, fast
      const { data: shop } = await supabase
        .from('shops')
        .select('is_approved, is_active, rejection_reason')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!mountedRef.current) return

      if (shop && shop.is_approved && shop.is_active) {
        // ✅ Approved — stop polling and navigate immediately via hard reload
        if (pollingRef.current) clearInterval(pollingRef.current)
        // Use hard navigation so server middleware and layout get fresh cookies
        window.location.href = '/shopkeeper'
        return
      }

      // Check documents only if shop not yet approved
      const { data: docs } = await supabase
        .from('shop_documents')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!mountedRef.current) return

      if (!docs) {
        setStatus({ approved: false, role: 'shopkeeper', message: 'No documents found. Please upload them.', needsRegistration: true, redirectUrl: '/login/shopkeeper/register/documents' })
        setLoading(false)
        return
      }

      if (docs.status === 'rejected') {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setStatus({ approved: false, role: 'shopkeeper', message: 'Your documents were rejected. Please contact support.' })
        setLoading(false)
        return
      }

      if (docs.status === 'pending') {
        setStatus({ approved: false, role: 'shopkeeper', message: 'Your documents are under review. We\'ll notify you once approved.' })
        setLoading(false)
        return
      }

      // Docs approved but shop not ready yet
      if (shop && shop.rejection_reason) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setStatus({ approved: false, role: 'shopkeeper', message: 'Registration rejected: ' + shop.rejection_reason })
      } else {
        setStatus({ approved: false, role: 'shopkeeper', message: 'Documents approved! Your shop is being set up by admin.' })
      }

    } else if (profile.role === 'delivery_agent') {
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('is_approved, is_active, rejection_reason')
        .eq('id', user.id)
        .maybeSingle()

      if (!mountedRef.current) return

      if (!agent) {
        setStatus({ approved: false, role: 'delivery_agent', message: 'No agent profile found. Please complete registration.', needsRegistration: true })
      } else if (agent.is_approved && agent.is_active) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        window.location.href = '/delivery'
        return
      } else if (agent.is_approved && !agent.is_active) {
        setStatus({ approved: false, role: 'delivery_agent', message: 'Your account is approved but not yet active. Please contact admin.' })
      } else if (agent.rejection_reason) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setStatus({ approved: false, role: 'delivery_agent', message: 'Registration rejected: ' + agent.rejection_reason })
      } else {
        setStatus({ approved: false, role: 'delivery_agent', message: 'Your agent registration is pending admin approval.' })
      }
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current)
      window.location.href = profile.role === 'shopkeeper' ? '/shopkeeper' : '/delivery'
      return
    }

    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    mountedRef.current = true
    checkApprovalStatus(false)

    // Poll every 4 seconds — fast enough to feel instant, light on DB
    pollingRef.current = setInterval(() => {
      checkApprovalStatus(true)
    }, 4000)

    return () => {
      mountedRef.current = false
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [checkApprovalStatus])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Checking status...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 32, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>

          {/* Animated icon */}
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>
            {status?.approved ? '✅' : status?.message?.includes('rejected') ? '❌' : '⏳'}
          </div>

          <h2 style={{ marginBottom: 8, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
            {status?.approved
              ? 'Approved!'
              : status?.message?.includes('rejected')
                ? 'Rejected'
                : 'Pending Approval'}
          </h2>

          <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6, fontSize: '0.9rem' }}>
            {status?.message}
          </p>

          {/* Auto-refresh indicator for pending states */}
          {!status?.approved && !status?.message?.includes('rejected') && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, fontSize: '0.78rem', color: '#94a3b8' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
              Auto-checking every 4 seconds...
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {status?.needsRegistration && (
              <button
                onClick={() => {
                  const url = status.redirectUrl || (status.role === 'shopkeeper' ? '/login/shopkeeper/register/documents' : '/login/delivery/register')
                  window.location.href = url
                }}
                style={{ padding: '14px 32px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
              >
                Complete Registration →
              </button>
            )}

            <button
              onClick={() => checkApprovalStatus(false)}
              style={{ padding: '12px 24px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              🔄 Check Now
            </button>

            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
              style={{ padding: '12px 24px', background: 'none', color: '#94a3b8', border: 'none', borderRadius: 12, fontWeight: 500, cursor: 'pointer', fontSize: '0.82rem' }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}