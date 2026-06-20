'use client'

import React from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  style?: React.CSSProperties
  className?: string
}

/**
 * Shimmer skeleton loader — provides a pulsing placeholder while content loads.
 * Matches Swiggy/Zepto/Amazon quality patterns.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 6,
  style,
  className,
}: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--bg-muted, #e2e8f0) 25%, var(--bg-hover, #f1f5f9) 50%, var(--bg-muted, #e2e8f0) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
        ...style,
      }}
      aria-hidden="true"
    />
  )
}

/**
 * A block of skeleton lines — common pattern for text-heavy loading states.
 */
export function SkeletonBlock({ lines = 3, lineHeight = 14, gap = 10, lastLineWidth = '60%' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  )
}

/**
 * Card skeleton — mimics a typical card layout (image + text lines).
 */
export function SkeletonCard({ height = 100 }: { height?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: 16,
        borderRadius: 12,
        background: 'var(--card-bg, white)',
        border: '1px solid var(--border-color, #e2e8f0)',
      }}
    >
      <Skeleton width={height} height={height} borderRadius={8} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="90%" height={12} />
        <Skeleton width="40%" height={12} />
      </div>
    </div>
  )
}

/**
 * Full-page loading state — use as a return-to-user placeholder.
 * Matches the pattern: "if (loading) return <LoadingPage />"
 */
export function LoadingPage({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Skeleton width={200} height={24} borderRadius={8} />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

/**
 * Table row skeleton — for admin table loading states.
 */
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '12px 8px' }}>
          <Skeleton
            width={i === 0 ? 120 : `${60 + Math.random() * 30}%`}
            height={14}
          />
        </td>
      ))}
    </tr>
  )
}
