'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function SplashPage() {
  const router = useRouter()
  const [phase, setPhase] = useState(0)
  const [progress, setProgress] = useState(0)
  const [bikeX, setBikeX] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  const TOTAL_MS = 3600

  useEffect(() => {
    setPhase(1)
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const t = Math.min(elapsed / TOTAL_MS, 1)

      setProgress(Math.min(t * 100, 96))

      const bikeStart = 400 / TOTAL_MS
      const bikeEnd = 2800 / TOTAL_MS
      if (t < bikeStart) {
        setBikeX(0)
      } else if (t < bikeEnd) {
        setBikeX(((t - bikeStart) / (bikeEnd - bikeStart)) * 100)
      } else {
        setBikeX(100)
      }

      if (elapsed < TOTAL_MS - 400) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setProgress(100)
        setBikeX(100)
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

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 0.5s ease',
      fontFamily: "'Poppins', sans-serif",
      position: 'relative',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

        @keyframes logoEntrance {
          0%   { opacity: 0; transform: scale(0.82) translateY(-16px); }
          65%  { opacity: 1; transform: scale(1.03) translateY(2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes progressGlow {
          0%, 100% { box-shadow: 0 0 6px rgba(249,115,22,0.35); }
          50%       { box-shadow: 0 0 16px rgba(249,115,22,0.65); }
        }
        @keyframes scooterBob {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
          50%      { transform: translate(-50%, -50%) translateY(-2px); }
        }
        @keyframes bottomSlideUp {
          0%   { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .anim-bottom { animation: bottomSlideUp 0.6s cubic-bezier(0.32,0.72,0,1) 0.5s both; }
        .anim-bar    { animation: progressGlow 1.5s ease-in-out infinite; }
        .anim-scooter-bob {
          animation: scooterBob 0.5s ease-in-out infinite;
        }
        .anim-artwork { animation: logoEntrance 0.9s cubic-bezier(0.32,0.72,0,1) 0.2s both; }
      `}</style>

      {/* ── RESPONSIVE SPLASH ARTWORK ── */}
      <div
        className={phase >= 1 ? 'anim-artwork' : ''}
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 5,
          padding: '0 16px',
        }}
      >
        <picture style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <source media="(min-width: 1280px)" srcSet="/splash/splash-desktop.webp" />
          <source media="(min-width: 768px)" srcSet="/splash/splash-tablet.webp" />
          <img
            src="/splash/splash-mobile.webp"
            alt="VarunsOnline"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </picture>
      </div>

      {/* ── BOTTOM: Progress bar + tagline ── */}
      <div
        className={phase >= 1 ? 'anim-bottom' : ''}
        style={{
          opacity: phase >= 1 ? 1 : 0,
          width: '100%',
          maxWidth: 440,
          padding: '0 32px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Progress track */}
        <div style={{ position: 'relative', height: 12 }}>
          <div style={{
            height: 12,
            background: '#e2e8f0',
            borderRadius: 99,
            overflow: 'visible',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)',
          }}>
            <div
              className="anim-bar"
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #f97316 0%, #fb923c 60%, #fdba74 100%)',
                borderRadius: 99,
                transition: 'width 0.1s linear',
                position: 'relative',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: 8, right: 8, height: 4,
                background: 'rgba(255,255,255,0.4)',
                borderRadius: 99,
              }} />
            </div>
          </div>

          {/* Scooter progress thumb */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `calc(${bikeX * 0.88}% + 6px)`,
            transform: 'translate(-50%, -50%)',
            transition: 'left 0.08s linear',
            zIndex: 10,
          }}>
            <div
              className="anim-scooter-bob"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#ffffff',
                border: '2.5px solid #f97316',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 3px 14px rgba(249,115,22,0.45)',
                fontSize: 16,
              }}
            >
              🛵
            </div>
          </div>
        </div>

        {/* Tagline */}
        <p style={{
          textAlign: 'center',
          fontSize: '0.84rem',
          color: '#64748b',
          fontWeight: 600,
          letterSpacing: '0.02em',
          margin: 0,
        }}>
          Preparing something great for you…
        </p>
      </div>
    </div>
  )
}
