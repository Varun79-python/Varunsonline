'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// This page existed as a duplicate of /login/shopkeeper/register/documents
// Redirect all traffic to the correct canonical path
export default function ShopDocumentsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/login/shopkeeper/register/documents')
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>📋</div>
        <p style={{ color: '#64748b' }}>Redirecting...</p>
      </div>
    </div>
  )
}
