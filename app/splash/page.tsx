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
        @keyframes charEntrance {
          0%   { opacity: 0; transform: translateY(30px) scale(0.92); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes charEntranceLeft {
          0%   { opacity: 0; transform: translateX(-30px) scale(0.92); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes charEntranceRight {
          0%   { opacity: 0; transform: translateX(30px) scale(0.92); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes bgReveal {
          0%   { opacity: 0; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes progressGlow {
          0%, 100% { box-shadow: 0 0 6px rgba(249,115,22,0.35); }
          50%       { box-shadow: 0 0 16px rgba(249,115,22,0.65); }
        }
        @keyframes scooterBob {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
          50%      { transform: translate(-50%, -50%) translateY(-2px); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes bottomSlideUp {
          0%   { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes phonePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.5); transform: translate(-50%, -50%) scale(1); }
          50%      { box-shadow: 0 0 0 12px rgba(249,115,22,0); transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes lineDraw {
          0%   { width: 0; }
          100% { width: 84%; }
        }

        .anim-bg     { animation: bgReveal 0.8s cubic-bezier(0.32,0.72,0,1) 0.05s both; }
        .anim-logo   { animation: logoEntrance 0.9s cubic-bezier(0.32,0.72,0,1) 0.1s forwards; }
        .anim-char-center { animation: charEntrance 0.7s cubic-bezier(0.32,0.72,0,1) 0.2s both; }
        .anim-char-left   { animation: charEntranceLeft 0.7s cubic-bezier(0.32,0.72,0,1) 0.15s both; }
        .anim-char-right  { animation: charEntranceRight 0.7s cubic-bezier(0.32,0.72,0,1) 0.3s both; }
        .anim-bottom { animation: bottomSlideUp 0.6s cubic-bezier(0.32,0.72,0,1) 0.5s both; }
        .anim-line   { animation: lineDraw 0.8s cubic-bezier(0.32,0.72,0,1) 0.25s both; }
        .anim-phone  { animation: phonePulse 2s ease-in-out 0.8s infinite; }
        .anim-bar    { animation: progressGlow 1.5s ease-in-out infinite; }
        .anim-scooter-bob {
          animation: scooterBob 0.5s ease-in-out infinite;
        }
        .float-anim {
          animation: floatSlow 3s ease-in-out infinite;
        }
      `}</style>

      {/* ── BACKGROUND ── */}
      <div
        className={phase >= 1 ? 'anim-bg' : ''}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '62%',
          opacity: phase >= 1 ? 1 : 0,
        }}
      >
        <img
          src="/splash/bg.png"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
          }}
        />
        {/* Gradient fade to white at bottom */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '40%',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 50%, #ffffff 100%)',
        }} />
      </div>

      {/* ── LOGO ── */}
      <div
        className={phase >= 1 ? 'anim-logo' : ''}
        style={{
          opacity: phase >= 1 ? 1 : 0,
          textAlign: 'center',
          paddingTop: 'max(24px, env(safe-area-inset-top, 16px))',
          zIndex: 10,
          position: 'relative',
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
            filter: 'drop-shadow(0 4px 16px rgba(249,115,22,0.2))',
          }}
        />
      </div>

      {/* ── ILLUSTRATIONS ── */}
      <div style={{
        flex: 1,
        width: '100%',
        maxWidth: 640,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 5,
        padding: '0 12px',
        marginTop: -12,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 'clamp(2px, 1.5vw, 16px)',
          width: '100%',
          height: '100%',
          maxHeight: '48vh',
          position: 'relative',
        }}>
          {/* Connecting dashed line between Shop and Customer */}
          <div
            className={phase >= 1 ? 'anim-line' : ''}
            style={{
              position: 'absolute',
              top: '38%',
              left: '8%',
              width: 0,
              height: 0,
              borderTop: '2.5px dashed #f97316',
              opacity: phase >= 1 ? 0.6 : 0,
              zIndex: 0,
            }}
          />

          {/* Phone icon on the dashed line */}
          <div
            className={phase >= 1 ? 'anim-phone' : ''}
            style={{
              position: 'absolute',
              top: '34%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#ffffff',
              border: '2.5px solid #f97316',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 3px 12px rgba(249,115,22,0.3)',
              fontSize: 18,
              zIndex: 6,
              opacity: phase >= 1 ? 1 : 0,
            }}
          >
            📱
          </div>

          {/* Shop (left) */}
          <div
            className={phase >= 1 ? 'anim-char-left float-anim' : ''}
            style={{
              opacity: phase >= 1 ? 1 : 0,
              flex: '0 1 auto',
              width: 'clamp(80px, 22vw, 180px)',
              height: 'auto',
              alignSelf: 'flex-end',
              marginBottom: 'clamp(4px, 2vw, 20px)',
              position: 'relative',
              zIndex: 2,
            }}
          >
            <img
              src="/splash/shop.png"
              alt=""
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>

          {/* Rider (center, hero) */}
          <div
            className={phase >= 1 ? 'anim-char-center float-anim' : ''}
            style={{
              opacity: phase >= 1 ? 1 : 0,
              flex: '0 1 auto',
              width: 'clamp(100px, 28vw, 220px)',
              height: 'auto',
              alignSelf: 'center',
              animationDelay: '0.3s',
              filter: 'drop-shadow(0 8px 24px rgba(249,115,22,0.2))',
              position: 'relative',
              zIndex: 3,
            }}
          >
            <img
              src="/splash/rider.png"
              alt="Delivery rider"
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>

          {/* Customer (right) */}
          <div
            className={phase >= 1 ? 'anim-char-right float-anim' : ''}
            style={{
              opacity: phase >= 1 ? 1 : 0,
              flex: '0 1 auto',
              width: 'clamp(80px, 22vw, 180px)',
              height: 'auto',
              alignSelf: 'flex-end',
              marginBottom: 'clamp(4px, 2vw, 20px)',
              position: 'relative',
              zIndex: 2,
            }}
          >
            <img
              src="/splash/customer.png"
              alt=""
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        </div>
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
