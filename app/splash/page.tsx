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
      background: 'white',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 0.5s ease',
    }}>
      <div style={{
        textAlign: 'center',
        animation: 'pulse 2s ease-in-out infinite',
      }}>
        <img src="/logo.png" alt="VarunsOnline" style={{
          width: 220,
          height: 220,
          objectFit: 'contain',
        }} />
        <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }`}</style>
      </div>
    </div>
  )
}
