'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function SplashPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [phase, setPhase] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  const TOTAL_MS = 3600

  useEffect(() => {
    setMounted(true)
    setPhase(1)
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current

      if (elapsed < TOTAL_MS - 400) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setFadeOut(true)
        setTimeout(() => router.replace('/login'), 500)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!mounted) {
    return <div style={{ minHeight: '100dvh', background: '#ffffff' }} />
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 0.5s ease',
      position: 'relative',
    }}>
      <style>{`
        @keyframes logoFadeIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        .anim-logo {
          animation: logoFadeIn 0.8s ease 0.1s forwards;
        }
      `}</style>

      {/* ── LOGO ── */}
      <div
        className={phase >= 1 ? 'anim-logo' : ''}
        style={{
          opacity: phase >= 1 ? 1 : 0,
          textAlign: 'center',
        }}
      >
        <img
          src="/logo.png"
          alt="VarunsOnline"
          style={{
            width: '170px',
            height: 'auto',
            maxHeight: '80px',
            objectFit: 'contain',
          }}
        />
      </div>
    </div>
  )
}
