'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SplashPage() {
  const router = useRouter()
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 2400)
    const redirectTimer = setTimeout(() => {
      router.replace('/login')
    }, 3000)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(redirectTimer)
    }
  }, [router])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #faf6f0 0%, #fff7ed 40%, #fef2e8 100%)',
        transition: 'opacity 0.6s ease',
        opacity: fadeOut ? 0 : 1,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 28,
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(249,115,22,0.15), 0 2px 8px rgba(249,115,22,0.08)',
          animation: 'splashBounce 2s ease-in-out infinite',
        }}
      >
        <img
          src="/logo.png"
          alt="Varun's Online"
          style={{
            width: 72,
            height: 72,
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Brand */}
      <h1
        style={{
          marginTop: 24,
          fontSize: 'clamp(1.6rem, 5vw, 2.4rem)',
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '-0.03em',
          animation: 'splashFadeUp 0.6s ease 0.2s both',
        }}
      >
        Varun&apos;s Online
      </h1>

      <p
        style={{
          marginTop: 6,
          fontSize: '0.9rem',
          color: '#94a3b8',
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          animation: 'splashFadeUp 0.6s ease 0.3s both',
        }}
      >
        Shop Local · Order Fast
      </p>

      {/* Progress bar */}
      <div
        style={{
          width: 160,
          height: 3,
          marginTop: 40,
          borderRadius: 999,
          background: '#e2e8f0',
          overflow: 'hidden',
          animation: 'splashFadeUp 0.6s ease 0.4s both',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 999,
            background: 'linear-gradient(90deg, #f97316, #ea580c)',
            animation: 'splashProgress 2.4s ease-in-out forwards',
          }}
        />
      </div>

      <style>{`
        @keyframes splashBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes splashFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  )
}
