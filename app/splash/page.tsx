'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SplashPage() {
  const router = useRouter()
  const [fadeOut, setFadeOut] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const fadeTimer = setTimeout(() => setFadeOut(true), 2500)
    const redirectTimer = setTimeout(() => router.replace('/login'), 3000)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(redirectTimer)
    }
  }, [router])

  if (!mounted) return null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .splash-root {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100dvh;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ── MESH GRADIENT BACKGROUND ── */
        .splash-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% 10%, rgba(99,102,241,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 80% 90%, rgba(249,115,22,0.15) 0%, transparent 55%),
            radial-gradient(ellipse 70% 80% at 50% 50%, rgba(255,255,255,1) 0%, #f0f4ff 60%, #e8effe 100%);
          z-index: 0;
        }

        /* ── ANIMATED GRID LINES ── */
        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px);
          background-size: 60px 60px;
          z-index: 1;
          animation: gridDrift 20s linear infinite;
        }

        /* ── FLOATING ORBS ── */
        .orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          z-index: 2;
          mix-blend-mode: multiply;
        }
        .orb-1 {
          width: 520px;
          height: 520px;
          background: radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%);
          top: -160px;
          left: -160px;
          animation: orbDrift1 12s ease-in-out infinite alternate;
          filter: blur(40px);
        }
        .orb-2 {
          width: 420px;
          height: 420px;
          background: radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%);
          bottom: -120px;
          right: -120px;
          animation: orbDrift2 10s ease-in-out infinite alternate;
          filter: blur(40px);
        }
        .orb-3 {
          width: 280px;
          height: 280px;
          background: radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 70%);
          bottom: 15%;
          left: 15%;
          animation: orbDrift3 14s ease-in-out infinite alternate;
          filter: blur(50px);
        }
        .orb-4 {
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%);
          top: 20%;
          right: 18%;
          animation: orbDrift1 9s ease-in-out infinite alternate-reverse;
          filter: blur(35px);
        }

        /* ── FLOATING PARTICLES ── */
        .particle {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          z-index: 3;
          opacity: 0;
          animation: particleFloat linear infinite;
        }

        /* ── SCENE ILLUSTRATION LAYER ── */
        .scene-layer {
          position: absolute;
          inset: 0;
          z-index: 4;
          pointer-events: none;
        }

        .illustration-wrapper {
          position: absolute;
          bottom: 10%;
        }
        .store-wrapper {
          left: 3%;
          animation: slideInLeft 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both,
                     floatY 6s ease-in-out 1.2s infinite;
        }
        .customer-wrapper {
          right: 3%;
          animation: slideInRight 1s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both,
                     floatY 6s ease-in-out 1.3s infinite;
        }

        .illustration {
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 20px 40px rgba(0,0,0,0.10));
        }
        .store-img  { width: 300px; max-width: 22vw; }
        .customer-img { width: 280px; max-width: 20vw; }

        /* ── RIDER ── */
        .rider-container {
          position: absolute;
          bottom: 4%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 5;
          pointer-events: none;
          animation: riderEntry 1s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both,
                     riderBob 3.5s ease-in-out 1.1s infinite;
        }
        .rider-img {
          width: 260px;
          max-width: 30vw;
          height: auto;
          filter: drop-shadow(0 16px 32px rgba(0,0,0,0.12));
        }

        /* ── SPEED LINES (behind rider) ── */
        .speed-lines {
          position: absolute;
          bottom: 6%;
          left: calc(50% - 200px);
          width: 160px;
          z-index: 4;
          display: flex;
          flex-direction: column;
          gap: 6px;
          pointer-events: none;
          animation: fadeInLeft 1s ease 0.8s both;
        }
        .speed-line {
          height: 2px;
          border-radius: 99px;
          background: linear-gradient(90deg, transparent, rgba(99,102,241,0.35));
          animation: speedLine 1.5s ease-in-out infinite;
        }
        .speed-line:nth-child(1) { width: 100%; animation-delay: 0s; }
        .speed-line:nth-child(2) { width: 70%;  animation-delay: 0.15s; }
        .speed-line:nth-child(3) { width: 85%;  animation-delay: 0.3s; }
        .speed-line:nth-child(4) { width: 55%;  animation-delay: 0.1s; }

        /* ── GROUND SHADOW ── */
        .ground-shadow {
          position: absolute;
          bottom: 3.5%;
          left: 50%;
          transform: translateX(-50%);
          width: 200px;
          height: 18px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(0,0,0,0.1) 0%, transparent 70%);
          z-index: 4;
          animation: shadowPulse 3.5s ease-in-out 1.1s infinite;
        }

        /* ── HERO CARD ── */
        .hero-card {
          position: relative;
          z-index: 10;
          text-align: center;
          width: 460px;
          max-width: 90vw;
          padding: 48px 44px 40px;
          background: rgba(255, 255, 255, 0.78);
          backdrop-filter: blur(28px) saturate(2);
          -webkit-backdrop-filter: blur(28px) saturate(2);
          border: 1px solid rgba(255, 255, 255, 0.65);
          border-radius: 32px;
          box-shadow:
            0 2px 4px rgba(0,0,0,0.02),
            0 8px 24px rgba(0,0,0,0.04),
            0 32px 80px rgba(99,102,241,0.10),
            inset 0 1px 0 rgba(255,255,255,0.9),
            inset 0 -1px 0 rgba(0,0,0,0.03);
          animation: cardEntrance 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }

        /* top accent stripe */
        .hero-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 60%;
          height: 3px;
          background: linear-gradient(90deg, #6366f1, #f97316, #ec4899);
          border-radius: 0 0 4px 4px;
          opacity: 0.85;
        }

        /* ── BADGE ── */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(249,115,22,0.08));
          border: 1px solid rgba(99,102,241,0.18);
          border-radius: 99px;
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 700;
          color: #6366f1;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 20px;
          animation: badgePop 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.7s both;
        }
        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #6366f1;
          animation: blink 1.5s ease-in-out infinite;
        }

        /* ── LOGO ── */
        .logo-glow {
          position: absolute;
          top: 30%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 160px;
          height: 160px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(249,115,22,0.10) 60%, transparent 100%);
          filter: blur(28px);
          z-index: 0;
          animation: logoPulse 4s ease-in-out infinite;
        }

        .logo-wrapper {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 96px;
          height: 96px;
          border-radius: 26px;
          background: linear-gradient(145deg, #fff 60%, #f0f4ff 100%);
          box-shadow:
            0 4px 12px rgba(99,102,241,0.12),
            0 1px 3px rgba(0,0,0,0.06),
            inset 0 1px 0 rgba(255,255,255,1);
          margin-bottom: 20px;
          animation: floatLogo 4s ease-in-out infinite;
          z-index: 1;
        }

        .brand-logo {
          width: 58px;
          height: 58px;
          object-fit: contain;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.06));
        }

        /* ── TYPOGRAPHY ── */
        .brand-title {
          font-size: 34px;
          font-weight: 900;
          letter-spacing: -0.04em;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #312e81 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 6px;
          line-height: 1.1;
        }

        .brand-tagline {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          background: linear-gradient(90deg, #f97316, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 14px;
        }

        .brand-subtext {
          font-size: 13.5px;
          color: #64748b;
          line-height: 1.6;
          font-weight: 500;
          max-width: 300px;
          margin: 0 auto;
        }

        /* ── FEATURE PILLS ── */
        .feature-pills {
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
          margin: 20px 0 0;
          animation: fadeInUp 0.6s ease 0.9s both;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11.5px;
          font-weight: 600;
          padding: 5px 11px;
          border-radius: 99px;
          border: 1px solid;
          line-height: 1;
        }
        .pill-blue {
          color: #3b82f6;
          border-color: rgba(59,130,246,0.2);
          background: rgba(59,130,246,0.06);
        }
        .pill-orange {
          color: #f97316;
          border-color: rgba(249,115,22,0.2);
          background: rgba(249,115,22,0.06);
        }
        .pill-green {
          color: #10b981;
          border-color: rgba(16,185,129,0.2);
          background: rgba(16,185,129,0.06);
        }

        /* ── LOADER ── */
        .loader-wrap {
          margin-top: 30px;
          position: relative;
        }
        .loader-track {
          height: 5px;
          width: 180px;
          margin: 0 auto;
          background: #f1f5f9;
          border-radius: 99px;
          overflow: hidden;
          position: relative;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.06);
        }
        .loader-fill {
          height: 100%;
          width: 0%;
          border-radius: 99px;
          background: linear-gradient(90deg, #6366f1 0%, #f97316 60%, #ec4899 100%);
          animation: fillBar 2.4s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards;
          position: relative;
        }
        .loader-fill::after {
          content: '';
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 0 0 2px #f97316, 0 2px 6px rgba(249,115,22,0.5);
        }
        .loader-label {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 600;
          letter-spacing: 0.06em;
          margin-top: 10px;
          animation: blinkText 1.5s ease-in-out infinite;
        }

        /* ── VERSION TAG ── */
        .version-tag {
          position: absolute;
          bottom: 18px;
          right: 22px;
          font-size: 10px;
          font-weight: 600;
          color: #cbd5e1;
          letter-spacing: 0.04em;
        }

        /* ══════════ KEYFRAMES ══════════ */

        @keyframes gridDrift {
          from { background-position: 0 0; }
          to   { background-position: 60px 60px; }
        }

        @keyframes orbDrift1 {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(40px, 30px) scale(1.1); }
        }
        @keyframes orbDrift2 {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-30px, -20px) scale(1.08); }
        }
        @keyframes orbDrift3 {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(20px, -25px) scale(1.06); }
        }

        @keyframes particleFloat {
          0%   { transform: translateY(0) scale(1);   opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 0.6; }
          100% { transform: translateY(-120px) scale(0.5); opacity: 0; }
        }

        @keyframes cardEntrance {
          from { opacity: 0; transform: scale(0.94) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        @keyframes badgePop {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes blinkText {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 0.35; }
        }

        @keyframes logoPulse {
          0%, 100% { opacity: 0.7; transform: translate(-50%,-50%) scale(1); }
          50%       { opacity: 1;   transform: translate(-50%,-50%) scale(1.2); }
        }

        @keyframes floatLogo {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-7px); }
        }

        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }

        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        @keyframes riderEntry {
          from { opacity: 0; transform: translate(-50%, 30px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes riderBob {
          0%, 100% { transform: translate(-50%, 0); }
          50%       { transform: translate(-50%, -5px); }
        }

        @keyframes shadowPulse {
          0%, 100% { transform: translateX(-50%) scaleX(1);   opacity: 0.9; }
          50%       { transform: translateX(-50%) scaleX(0.82); opacity: 0.5; }
        }

        @keyframes speedLine {
          0%   { opacity: 0; transform: scaleX(0); transform-origin: right; }
          40%  { opacity: 1; }
          100% { opacity: 0; transform: scaleX(1); transform-origin: right; }
        }

        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes fillBar {
          0%   { width: 0%; }
          100% { width: 100%; }
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 1024px) {
          .store-img    { width: 220px; }
          .customer-img { width: 200px; }
        }
        @media (max-width: 768px) {
          .illustration-wrapper { display: none !important; }
          .speed-lines          { display: none !important; }
          .rider-img            { width: 210px; max-width: 55vw; }
          .hero-card            { padding: 40px 24px 32px; }
          .brand-title          { font-size: 28px; }
          .loader-track         { width: 150px; }
        }
        @media (max-width: 380px) {
          .hero-card    { max-width: 96vw; padding: 32px 18px 28px; }
          .brand-title  { font-size: 24px; }
          .feature-pills { gap: 6px; }
        }
      `}</style>

      <div
        className="splash-root"
        style={{ opacity: fadeOut ? 0 : 1 }}
      >
        {/* ── BACKGROUND ── */}
        <div className="splash-bg" />
        <div className="grid-overlay" />

        {/* ── ORBS ── */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />

        {/* ── FLOATING PARTICLES ── */}
        {[
          { size: 6, left: '15%', delay: '0s', dur: '4s', color: 'rgba(99,102,241,0.5)' },
          { size: 4, left: '28%', delay: '0.8s', dur: '5.5s', color: 'rgba(249,115,22,0.5)' },
          { size: 8, left: '42%', delay: '1.4s', dur: '4.8s', color: 'rgba(16,185,129,0.4)' },
          { size: 5, left: '58%', delay: '0.4s', dur: '6s', color: 'rgba(236,72,153,0.45)' },
          { size: 7, left: '72%', delay: '2s', dur: '4.2s', color: 'rgba(99,102,241,0.4)' },
          { size: 4, left: '85%', delay: '1s', dur: '5s', color: 'rgba(249,115,22,0.45)' },
          { size: 6, left: '90%', delay: '0.2s', dur: '4.5s', color: 'rgba(16,185,129,0.35)' },
        ].map((p, i) => (
          <div
            key={i}
            className="particle"
            style={{
              width: p.size,
              height: p.size,
              left: p.left,
              bottom: '8%',
              background: p.color,
              animationDuration: p.dur,
              animationDelay: p.delay,
            }}
          />
        ))}

        {/* ── SCENE LAYER ── */}
        <div className="scene-layer">
          {/* Store */}
          <div className="illustration-wrapper store-wrapper">
            <img
              src="/splash/shop.png"
              alt="Local Store"
              className="illustration store-img"
            />
          </div>

          {/* Customer */}
          <div className="illustration-wrapper customer-wrapper">
            <img
              src="/splash/customer.png"
              alt="Happy Customer"
              className="illustration customer-img"
            />
          </div>

          {/* Speed lines */}
          <div className="speed-lines">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="speed-line" />
            ))}
          </div>

          {/* Ground shadow */}
          <div className="ground-shadow" />

          {/* Rider */}
          <div className="rider-container">
            <img
              src="/splash/rider.png"
              alt="Delivery Rider"
              className="rider-img"
            />
          </div>
        </div>

        {/* ── HERO CARD ── */}
        <div className="hero-card">
          {/* Logo glow */}
          <div className="logo-glow" />

          {/* Live badge */}
          <div className="badge">
            <span className="badge-dot" />
            Now Live in Your City
          </div>

          {/* Logo */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="logo-wrapper">
              <img
                src="/logo.png"
                alt="VarunsOnline Logo"
                className="brand-logo"
              />
            </div>
          </div>

          {/* Text */}
          <h1 className="brand-title">VarunsOnline</h1>
          <p className="brand-tagline">Your Local Shopping Platform</p>
          <p className="brand-subtext">
            Shop from your favourite nearby stores.<br />
            delivery, right to your doorstep.
          </p>

          {/* Feature pills */}
          <div className="feature-pills">
            <span className="pill pill-blue">🏪 Local Stores</span>
            <span className="pill pill-orange">⚡Delivery</span>
            <span className="pill pill-green">✅ Best Prices</span>
          </div>

          {/* Loader */}
          <div className="loader-wrap">
            <div className="loader-track">
              <div className="loader-fill" />
            </div>
            <p className="loader-label">Loading your experience…</p>
          </div>

          {/* Version */}
          <span className="version-tag">v2.0</span>
        </div>
      </div>
    </>
  )
}