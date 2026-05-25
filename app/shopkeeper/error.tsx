'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ShopkeeperError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Shopkeeper error:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <div style={{
        textAlign: 'center',
        background: 'white',
        padding: 40,
        borderRadius: 20,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        maxWidth: 400,
        width: '100%'
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>⚠️</div>
        <h2 style={{
          fontSize: '1.3rem',
          fontWeight: 700,
          color: '#0f172a',
          marginBottom: 8
        }}>
          Something went wrong
        </h2>
        <p style={{
          color: '#64748b',
          marginBottom: 24,
          fontSize: '0.9rem',
          lineHeight: 1.6
        }}>
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>

        <button
          onClick={reset}
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: 12
          }}
        >
          🔄 Try Again
        </button>

        <button
          onClick={() => router.push('/shopkeeper')}
          style={{
            width: '100%',
            padding: '14px',
            background: '#f1f5f9',
            color: '#475569',
            border: 'none',
            borderRadius: 12,
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  )
}
