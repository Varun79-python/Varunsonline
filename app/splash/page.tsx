'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SplashPage() {
  const router = useRouter()
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true)
      setTimeout(() => router.replace('/login'), 500)
    }, 2000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 0.5s ease',
    }}>
      <div style={{
        textAlign: 'center',
        animation: 'pulse 2s ease-in-out infinite',
      }}>
        <img src="/logo.png" alt="VarunsOnline" style={{
          width: 140,
          height: 140,
          objectFit: 'contain',
          filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.2))',
        }} />
        <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }`}</style>
      </div>
    </div>
  )
}