'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)

  // Refs to prevent race conditions and duplicate requests
  const mountedRef = useRef(false)
  const checkingRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isLoginPage = pathname === '/admin/login'

  const validateAdmin = async (user: User) => {
    if (!mountedRef.current) return
    const metaRole = user?.user_metadata?.role || user?.app_metadata?.role
    if (metaRole === 'admin') {
      setChecking(false)
      return
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role === 'admin') {
      setChecking(false)
      return
    }
    // Not admin — redirect without signing out (the user may be logged into another role)
    router.replace('/admin/login')
  }

  const checkAuth = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    try {
      // getSession reads from cookie — fast, no network call
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.replace('/admin/login')
        return
      }
      await validateAdmin(session.user)
    } catch (error) {
      console.error('Auth check error:', error)
      // Do NOT redirect on error — could be a transient network issue
    } finally {
      checkingRef.current = false
    }
  }, [supabase, router])

  useEffect(() => {
    mountedRef.current = true
    if (isLoginPage) {
      setChecking(false)
      return
    }
    checkAuth()
    return () => {
      mountedRef.current = false
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoginPage) return <>{children}</>

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, border: '4px solid #e2e8f0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Verifying admin access...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div className="admin-root">
      <main className="admin-main">{children}</main>

      <style>{`
        .admin-root {
          min-height: 100vh;
          background: #F8FAFC;
        }
        .admin-main {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 20px;
          min-height: 100vh;
        }
        @media (max-width: 768px) {
          .admin-main {
            padding: 16px 14px;
          }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
