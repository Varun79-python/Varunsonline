'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SplashPage() {
  const router = useRouter()
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 2800)
    const redirectTimer = setTimeout(() => {
      router.replace('/login')
    }, 3500)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(redirectTimer)
    }
  }, [router])

  return (
    <>
      <style jsx>{`
        .splash {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at top left, rgba(0,229,255,.15), transparent 30%),
            radial-gradient(circle at bottom right, rgba(124,58,237,.20), transparent 35%),
            linear-gradient(135deg,#050816 0%,#0f172a 45%,#1e1b4b 100%);
          transition: opacity .7s ease;
          opacity: ${fadeOut ? 0 : 1};
        }

        .particles {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .particle {
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,.2);
          animation: float linear infinite;
        }

        /* ── HERO CARD ── */
        .hero-card {
          position: relative;
          z-index: 10;
        }

        .center {
          z-index: 2;
          text-align: center;
          padding: 24px;
        }

        .glow {
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(0,229,255,.25),
            rgba(124,58,237,.15),
            transparent
          );
          filter: blur(40px);
          animation: pulse 3s infinite ease-in-out;
        }

        .logoBox {
          position: relative;
          width: 140px;
          height: 140px;
          margin: auto;
          border-radius: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(20px);
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12);
          box-shadow:
            0 0 40px rgba(0,229,255,.25),
            0 0 100px rgba(124,58,237,.20);
          animation: floatLogo 4s infinite ease-in-out;
        }

        .logo {
          width: 80px;
          height: 80px;
          object-fit: contain;
        }

        .title {
          margin-top: 28px;
          font-size: clamp(2rem,5vw,4rem);
          font-weight: 900;
          color: white;
          letter-spacing: -2px;
        }

        .tagline {
          margin-top: 10px;
          color: #94a3b8;
          font-size: 1rem;
          letter-spacing: .15em;
          text-transform: uppercase;
        }

        .loader {
          width: 220px;
          height: 6px;
          margin: 35px auto 0;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255,255,255,.1);
        }

        .loaderFill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            #00e5ff,
            #7c3aed
          );
          animation: loading 3s linear forwards;
        }

        .powered {
          margin-top: 20px;
          color: rgba(255,255,255,.5);
          font-size: 12px;
          letter-spacing: .2em;
        }

        @keyframes loading {
          from { width: 0%; }
          to { width: 100%; }
        }

        @keyframes pulse {
          0%,100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
        }

        @keyframes floatLogo {
          0%,100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-12px);
          }
        }

        @keyframes float {
          from {
            transform: translateY(100vh);
            opacity: 0;
          }
          20% {
            opacity: .7;
          }
          100% {
            transform: translateY(-120px);
            opacity: 0;
          }
        }
      `}</style>

      <div className="splash">
        <div className="particles">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                width: `${4 + Math.random() * 8}px`,
                height: `${4 + Math.random() * 8}px`,
                left: `${Math.random() * 100}%`,
                animationDuration: `${10 + Math.random() * 10}s`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>

        <div className="center">
          <div className="glow" />

          <div className="logoBox">
            <img
              src="/logo.png"
              alt="Varun's Online"
              className="logo"
            />
          </div>

          <h1 className="title">VARUN'S ONLINE</h1>

          <p className="tagline">
            Shop Local • Order Fast
          </p>

          <div className="loader">
            <div className="loaderFill" />
          </div>

          <div className="powered">
            LOCAL COMMERCE REIMAGINED
          </div>
        </div>
      </div>
    </>
  )
}
