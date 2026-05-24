'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { checkShopkeeperStatus } from '@/app/admin/actions'

export default function ApprovalStatusPage() {
  const router = useRouter()
  // Memoize supabase so it doesn't change identity on every render (prevents infinite polling loop)
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [icon, setIcon] = useState('⏳')
  const [needsDocs, setNeedsDocs] = useState(false)
  const [isRejected, setIsRejected] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const checkStatus = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!mountedRef.current) return

    if (!user) {
      router.push('/login')
      return
    }

    // Get role from profile (anon client can read profiles — usually no RLS issue)
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle()

    if (!mountedRef.current) return
    if (!profile) {
      setMessage('Profile not found. Please contact support.')
      setIcon('❌')
      setLoading(false)
      return
    }

    setRole(profile.role)

    if (profile.role === 'shopkeeper') {
      // ✅ Use server action — bypasses RLS on shops table
      const result = await checkShopkeeperStatus()
      if (!mountedRef.current) return

      if (result.status === 'approved') {
        // Approved! Hard navigate to dashboard
        if (pollingRef.current) clearInterval(pollingRef.current)
        window.location.href = '/shopkeeper'
        return
      }

      if (result.status === 'blocked') {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setIsRejected(true)
        setIcon('🚫')
        setMessage('Your shop has been blocked by the admin. Please contact support.')
        setLoading(false)
        return
      }

      if (result.status === 'rejected') {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setIsRejected(true)
        setIcon('❌')
        setMessage('Registration rejected: ' + (result.reason || 'Contact support.'))
        setLoading(false)
        return
      }

      if (result.status === 'docs_rejected') {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setIsRejected(true)
        setIcon('❌')
        setMessage('Your documents were rejected. Please contact support or re-register.')
        setLoading(false)
        return
      }

      if (result.status === 'no_documents') {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setNeedsDocs(true)
        setIcon('📋')
        setMessage('No documents found. Please upload your shop documents.')
        setLoading(false)
        return
      }

      if (result.status === 'docs_pending') {
        setIcon('⏳')
        setMessage("Your documents are under review by admin. You'll be redirected automatically once approved.")
        setLoading(false)
        return
      }

      if (result.status === 'docs_approved_shop_pending') {
        setIcon('⏳')
        setMessage('Documents approved! Admin is activating your shop — please wait a moment.')
        setLoading(false)
        return
      }

      setMessage('Checking your approval status...')
      setLoading(false)

    } else if (profile.role === 'delivery_agent') {
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('is_approved, is_active, aadhar_url, rejection_reason')
        .eq('id', user.id)
        .maybeSingle()

      if (!mountedRef.current) return

      if (!agent) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setNeedsDocs(true)
        setIcon('📋')
        setMessage('No agent profile found. Please complete your registration.')
        setLoading(false)
        return
      }

      // ✅ Approved and active → go to dashboard
      if (agent.is_approved && agent.is_active) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        window.location.href = '/delivery'
        return
      }

      // Rejected
      if (agent.rejection_reason) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setIsRejected(true)
        setIcon('❌')
        setMessage('Registration rejected: ' + agent.rejection_reason)
        setLoading(false)
        return
      }

      // No Aadhaar doc uploaded yet
      if (!agent.aadhar_url) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setNeedsDocs(true)
        setIcon('📋')
        setMessage('Please upload your Aadhaar document to complete registration.')
        setLoading(false)
        return
      }

      // Pending approval
      setIcon('⏳')
      setMessage('Your agent registration is pending admin approval. You will be redirected automatically once approved.')
      setLoading(false)
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current)
      window.location.href = profile.role === 'shopkeeper' ? '/shopkeeper' : '/delivery'
    }
  }, [router, supabase])

  useEffect(() => {
    mountedRef.current = true
    checkStatus(false)

    // Poll every 5 seconds
    pollingRef.current = setInterval(() => checkStatus(true), 5000)

    return () => {
      mountedRef.current = false
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [checkStatus])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Checking status...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 32, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>{icon}</div>

          <h2 style={{ marginBottom: 8, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
            {icon === '✅' ? 'Approved!' : isRejected ? 'Rejected' : 'Pending Approval'}
          </h2>

          <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6, fontSize: '0.9rem' }}>
            {message}
          </p>

          {/* Auto-checking pulse for pending states */}
          {!isRejected && !needsDocs && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, fontSize: '0.78rem', color: '#94a3b8' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
              Auto-checking every 5 seconds...
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {needsDocs && (
              <button
                onClick={() => {
                  const url = role === 'shopkeeper' ? '/login/shopkeeper/register/documents' : '/login/delivery/register'
                  window.location.href = url
                }}
                style={{ padding: '14px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
              >
                Upload Documents →
              </button>
            )}

            <button
              onClick={() => checkStatus(false)}
              style={{ padding: '12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              🔄 Check Now
            </button>

            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
              style={{ padding: '10px', background: 'none', color: '#94a3b8', border: 'none', borderRadius: 12, fontWeight: 500, cursor: 'pointer', fontSize: '0.82rem' }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}