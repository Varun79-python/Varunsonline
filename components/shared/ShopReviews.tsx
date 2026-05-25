'use client'

import React, { useEffect, useState } from 'react'
import StarRating, { RatingInput } from './StarRating'
import { createClient } from '@/lib/supabase/client'

interface Review {
  id: string
  rating: number
  text: string | null
  customerName: string
  createdAt: string
}

interface ReviewStats {
  averageRating: number
  totalRatings: number
}

interface ShopReviewsProps {
  shopId: string
  /** If provided, allows the customer to submit a review for this delivered order */
  orderId?: string
  /** Called after successful review submission */
  onReviewSubmitted?: () => void
}

export default function ShopReviews({ shopId, orderId, onReviewSubmitted }: ShopReviewsProps) {
  const supabase = createClient()
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ReviewStats>({ averageRating: 0, totalRatings: 0 })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newRating, setNewRating] = useState(0)
  const [newReview, setNewReview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  useEffect(() => {
    loadReviews()
  }, [shopId])

  async function loadReviews() {
    setLoading(true)
    try {
      const res = await fetch(`/api/reviews?shop_id=${shopId}&limit=50`)
      const data = await res.json()
      if (data.reviews) setReviews(data.reviews)
      if (data.stats) setStats(data.stats)
    } catch (err) {
      console.error('Failed to load reviews', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (newRating < 1) return
    if (!orderId) return

    setSubmitting(true)
    setSubmitError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setSubmitError('Please log in to submit a review')
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          order_id: orderId,
          shop_id: shopId,
          rating: newRating,
          review_text: newReview.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          setSubmitError('You have already reviewed this order')
        } else {
          setSubmitError(data.error || 'Failed to submit review')
        }
        setSubmitting(false)
        return
      }

      // Reset + reload
      setNewRating(0)
      setNewReview('')
      setShowForm(false)
      onReviewSubmitted?.()
      await loadReviews()
    } catch (err) {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const displayed = reviews.slice(0, (page + 1) * PAGE_SIZE)
  const hasMore = displayed.length < reviews.length

  return (
    <div>
      {/* Header with aggregate rating */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Reviews & Ratings</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <StarRating rating={stats.averageRating} size={18} showValue />
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              ({stats.totalRatings} {stats.totalRatings === 1 ? 'review' : 'reviews'})
            </span>
          </div>
        </div>
        {orderId && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1.5px solid #f97316',
              background: 'white',
              color: '#f97316',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            Write a Review
          </button>
        )}
      </div>

      {/* Review form */}
      {showForm && (
        <div
          style={{
            background: '#fff7ed',
            border: '1.5px solid #fed7aa',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>
            Rate this shop
          </h4>
          <RatingInput value={newRating} onChange={setNewRating} label="" />
          <div style={{ marginTop: 12 }}>
            <textarea
              placeholder="Share your experience (optional)"
              value={newReview}
              onChange={e => setNewReview(e.target.value)}
              maxLength={500}
              style={{
                width: '100%',
                minHeight: 80,
                padding: 12,
                borderRadius: 8,
                border: '1.5px solid #e2e8f0',
                fontSize: '0.88rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                background: 'white',
              }}
            />
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'right', marginTop: 4 }}>
              {newReview.length}/500
            </div>
          </div>
          {submitError && (
            <p style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: 8 }}>{submitError}</p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={handleSubmit}
              disabled={newRating < 1 || submitting}
              className="btn btn-primary btn-sm"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
            <button
              onClick={() => { setShowForm(false); setSubmitError('') }}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
          Loading reviews...
        </div>
      ) : reviews.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            background: '#f8fafc',
            borderRadius: 12,
            border: '1px dashed #e2e8f0',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📝</div>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            No reviews yet. Be the first to review!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {displayed.map(review => (
            <div
              key={review.id}
              style={{
                background: 'white',
                border: '1.5px solid #e2e8f0',
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#64748b',
                    }}
                  >
                    {review.customerName.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
                    {review.customerName}
                  </span>
                </div>
                <StarRating rating={review.rating} size={14} />
              </div>
              {review.text && (
                <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, marginTop: 4 }}>
                  {review.text}
                </p>
              )}
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 6 }}>
                {new Date(review.createdAt).toLocaleDateString('en-IN', {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </p>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '10px',
                borderRadius: 8,
                border: '1.5px solid #e2e8f0',
                background: 'white',
                color: '#f97316',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Show more reviews ({reviews.length - displayed.length} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
