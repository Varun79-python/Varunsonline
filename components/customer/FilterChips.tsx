'use client'

/* ── Types matching the browse URL params ─────────────────────────── */
export interface ActiveFilters {
  q?: string
  categories: string[]
  shops: string[]
  minPrice?: number
  maxPrice?: number
  minRating?: number
  availability: 'all' | 'in_stock' | 'out_of_stock'
  maxDistance?: number
  sort: string
}

interface FilterChipsProps {
  filters: ActiveFilters
  /** Map of shop id → shop name */
  shopNames: Record<string, string>
  onRemove: (key: string, value?: string) => void
  onClearAll: () => void
}

const RATING_LABELS: Record<number, string> = { 4: '4★ & up', 3: '3★ & up', 2: '2★ & up', 1: '1★ & up' }
const DISTANCE_LABELS: Record<number, string> = { 1: 'Within 1 km', 3: 'Within 3 km', 5: 'Within 5 km', 10: 'Within 10 km', 20: 'Within 20 km' }
const AVAIL_LABELS: Record<string, string> = { in_stock: 'In Stock', out_of_stock: 'Out of Stock' }

export default function FilterChips({ filters, shopNames, onRemove, onClearAll }: FilterChipsProps) {
  // Collect active chips
  const chips: { key: string; label: string; value?: string }[] = []

  if (filters.q) chips.push({ key: 'q', label: `"${filters.q}"` })
  for (const cat of filters.categories) chips.push({ key: 'cat', label: cat, value: cat })
  for (const sid of filters.shops) {
    chips.push({ key: 'shops', label: shopNames[sid] || sid.slice(0, 8), value: sid })
  }
  if (filters.minPrice != null) {
    chips.push({
      key: 'min_p',
      label: `Min ₹${filters.minPrice}`,
    })
  }
  if (filters.maxPrice != null) {
    chips.push({
      key: 'max_p',
      label: `Max ₹${filters.maxPrice}`,
    })
  }
  if (filters.minRating != null && filters.minRating > 0) {
    chips.push({
      key: 'min_r',
      label: RATING_LABELS[filters.minRating] || `${filters.minRating}★ & up`,
    })
  }
  if (filters.availability !== 'all') {
    chips.push({ key: 'avail', label: AVAIL_LABELS[filters.availability] || filters.availability })
  }
  if (filters.maxDistance != null) {
    chips.push({
      key: 'dist',
      label: DISTANCE_LABELS[filters.maxDistance] || `${filters.maxDistance} km`,
    })
  }

  if (chips.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {chips.map(chip => (
        <span
          key={`${chip.key}-${chip.value || chip.label}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#fff7ed', border: '1px solid #fed7aa',
            borderRadius: 20, padding: '4px 10px 4px 12px',
            fontSize: '0.78rem', fontWeight: 600, color: '#c2410c',
            cursor: 'default',
          }}
        >
          {chip.label}
          <button
            onClick={() => onRemove(chip.key, chip.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 16, height: 16, borderRadius: '50%',
              border: 'none', background: 'rgba(194,65,12,0.12)',
              color: '#c2410c', cursor: 'pointer', padding: 0,
              fontSize: '0.65rem', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </span>
      ))}

      <button
        onClick={onClearAll}
        style={{
          background: 'none', border: 'none', color: '#dc2626',
          fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
          textDecoration: 'underline', padding: '4px 4px',
        }}
      >
        Clear all
      </button>
    </div>
  )
}
