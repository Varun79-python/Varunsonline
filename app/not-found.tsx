import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: '#ffffff',
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, #fff7ed 0%, transparent 65%)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 30,
            background: '#fff7ed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: '3rem',
          }}
        >
          🔍
        </div>
        <h1
          style={{
            fontSize: '4rem',
            fontWeight: 900,
            color: '#0f172a',
            margin: '0 0 4px',
            lineHeight: 1,
          }}
        >
          404
        </h1>
        <p
          style={{
            fontSize: '1.1rem',
            color: '#64748b',
            margin: '0 0 8px',
            fontWeight: 600,
          }}
        >
          Page not found
        </p>
        <p
          style={{
            fontSize: '0.9rem',
            color: '#94a3b8',
            margin: '0 0 32px',
          }}
        >
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 28px',
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 14,
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
          }}
        >
          ← Go Home
        </Link>
      </div>
    </div>
  )
}
