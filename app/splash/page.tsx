'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SplashPage() {
  const router = useRouter()
  const [fadeOut, setFadeOut] = useState(false)

  function skip() {
    setFadeOut(true)
    setTimeout(() => router.replace('/login'), 500)
  }

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
      position: 'relative',
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

      {/* Skip button */}
      <button
        onClick={skip}
        style={{
          position: 'absolute',
          bottom: 40,
          right: 40,
          padding: '10px 20px',
          background: 'transparent',
          color: '#94a3b8',
          border: '1.5px solid #e2e8f0',
          borderRadius: 10,
          fontWeight: 600,
          fontSize: '0.85rem',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#f97316'
          e.currentTarget.style.color = '#f97316'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = '#e2e8f0'
          e.currentTarget.style.color = '#94a3b8'
        }}
      >
        Skip →
      </button>
    </div>
  )
}
