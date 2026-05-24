'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PlansSettingsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/settings') }, [router])
  return <p style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Redirecting to Settings...</p>
}
