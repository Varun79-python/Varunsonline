'use client'

import React, { useEffect, useState } from 'react'
import StarRating from './StarRating'

interface ProductRating {
  id: string
  rating: number
  text: string | null
  customerName: string
  createdAt: string
}

interface RatingStats {
  averageRating: number
  totalRatings: number
}

interface ProductReviewsProps {
  productId: string
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const [ratings, setRatings] = useState<ProductRating[]>([])
  const [stats, setStats] = useState<RatingStats>({ averageRating: 0, totalRatings: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  useEffect(() => {
    loadRatings()
  }, [productId])

  async function loadRatings() {
    setLoading(true)
    try {
      const res = await fetch(`/api/product-ratings?product_id=${productId}&limit=50`)
      const data = await res.json()
      if (data.ratings) setRatings(data.ratings)
      if (data.stats) setStats(data.stats)
    } catch (err) {
      console.error('Failed to load product ratings', err)
    } finally {
      setLoading(false)
    }
  }

  const displayed = ratings.slice(0, (page + 1) * PAGE_SIZE)
  const hasMore = displayed.length < ratings.length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>Product Ratings</h4>
        {stats.totalRatings > 0 && (
          <>
            <StarRating rating={stats.averageRating} size={14} showValue />
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              ({stats.totalRatings})
            </span>
          </>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
          Loading ratings...
        </div>
      ) : ratings.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No ratings yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayed.map(r => (
            <div
              key={r.id}
              style={{
                padding: '10px 12px',
                background: '#f8fafc',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' }}>
                  {r.customerName}
                </span>
                <StarRating rating={r.rating} size={12} />
              </div>
              {r.text && (
                <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: 4 }}>
                  {r.text}
                </p>
              )}
            </div>
          ))}
          {hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '8px',
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                background: 'white',
                color: '#f97316',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              Show more ({ratings.length - displayed.length})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
