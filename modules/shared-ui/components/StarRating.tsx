'use client'

import React from 'react'

interface StarRatingProps {
  rating: number
  maxRating?: number
  size?: number
  interactive?: boolean
  onChange?: (rating: number) => void
  showValue?: boolean
}

/**
 * Reusable star rating component.
 * - Read-only mode: displays filled/half-filled stars
 * - Interactive mode: click to set rating, hover preview
 * - Sizes match Swiggy/Zepto/Amazon patterns
 */
export default function StarRating({
  rating,
  maxRating = 5,
  size = 16,
  interactive = false,
  onChange,
  showValue = false,
}: StarRatingProps) {
  const [hovered, setHovered] = React.useState(0)

  const displayRating = interactive && hovered > 0 ? hovered : rating
  const fullStars = Math.floor(displayRating)
  const hasHalf = displayRating - fullStars >= 0.25 && displayRating - fullStars < 0.75
  const emptyStars = maxRating - fullStars - (hasHalf ? 1 : 0)

  const starStyle: React.CSSProperties = {
    display: 'inline-block',
    fontSize: size,
    lineHeight: 1,
    cursor: interactive ? 'pointer' : 'default',
    userSelect: 'none',
    transition: 'transform 0.1s ease',
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} role="img" aria-label={`${rating} out of ${maxRating} stars`}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <span
          key={`full-${i}`}
          style={{ ...starStyle, color: '#f59e0b' }}
          onClick={() => interactive && onChange?.(i + 1)}
          onMouseEnter={() => interactive && setHovered(i + 1)}
          onMouseLeave={() => interactive && setHovered(0)}
          onTouchEnd={() => interactive && onChange?.(i + 1)}
        >
          ★
        </span>
      ))}
      {hasHalf && (
        <span
          key="half"
          style={{ ...starStyle, color: '#f59e0b', position: 'relative' }}
          onClick={() => interactive && onChange?.(fullStars + 1)}
          onMouseEnter={() => interactive && setHovered(fullStars + 1)}
          onMouseLeave={() => interactive && setHovered(0)}
        >
          <span style={{ position: 'absolute', left: 0, top: 0, overflow: 'hidden', width: '50%', color: '#f59e0b' }}>★</span>
          <span style={{ color: '#d1d5db' }}>★</span>
        </span>
      )}
      {Array.from({ length: Math.max(0, emptyStars) }).map((_, i) => (
        <span
          key={`empty-${i}`}
          style={{ ...starStyle, color: '#d1d5db' }}
          onClick={() => interactive && onChange?.(fullStars + (hasHalf ? 1 : 0) + i + 1)}
          onMouseEnter={() => interactive && setHovered(fullStars + (hasHalf ? 1 : 0) + i + 1)}
          onMouseLeave={() => interactive && setHovered(0)}
        >
          ★
        </span>
      ))}
      {showValue && (
        <span style={{ marginLeft: 6, fontSize: size * 0.85, color: '#64748b', fontWeight: 600 }}>
          {rating.toFixed(1)}
        </span>
      )}
    </span>
  )
}

/**
 * Large interactive rating input — used in modals / review forms.
 * Shows numeric label and "Tap to rate" helper text.
 */
export function RatingInput({
  value,
  onChange,
  label = 'Rating',
}: {
  value: number
  onChange: (v: number) => void
  label?: string
}) {
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>{label}</span>
      <StarRating rating={value} size={36} interactive onChange={onChange} />
      {value > 0 && (
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>
          {labels[value]}
        </span>
      )}
      {value === 0 && (
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tap to rate</span>
      )}
    </div>
  )
}
