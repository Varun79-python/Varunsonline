'use client'

import { useState, useEffect } from 'react'

/* ── Inline SVG Icons ──────────────────────────────────────────────── */
const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
)
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
)

/* ── Types ────────────────────────────────────────────────────────── */
export interface FilterState {
  q: string
  categories: string[]
  shops: string[]
  minPrice: string
  maxPrice: string
  minRating: number
  availability: 'all' | 'in_stock' | 'out_of_stock'
  maxDistance: number
  sort: string
}

interface ProductFiltersProps {
  filters: FilterState
  availableCategories: string[]
  /** All available shops for the filter checkboxes */
  availableShops: { id: string; name: string }[]
  onChange: (filters: FilterState) => void
  onClose?: () => void
  /** Mobile drawer mode */
  drawer?: boolean
  onSubmit?: () => void
}

/* ── Constants for radio groups ───────────────────────────────────── */
const RATING_OPTIONS = [
  { value: 0, label: 'Any Rating' },
  { value: 4, label: '4★ & above' },
  { value: 3, label: '3★ & above' },
  { value: 2, label: '2★ & above' },
  { value: 1, label: '1★ & above' },
]

const AVAIL_OPTIONS: { value: FilterState['availability']; label: string }[] = [
  { value: 'all', label: 'All Products' },
  { value: 'in_stock', label: 'In Stock Only' },
  { value: 'out_of_stock', label: 'Out of Stock' },
]

const DISTANCE_OPTIONS = [
  { value: 0, label: 'All distances' },
  { value: 1, label: 'Within 1 km' },
  { value: 3, label: 'Within 3 km' },
  { value: 5, label: 'Within 5 km' },
  { value: 10, label: 'Within 10 km' },
  { value: 20, label: 'Within 20 km' },
]

/* ── Section header style ─────────────────────────────────────────── */
const sectionHeader: React.CSSProperties = {
  fontWeight: 700, fontSize: '0.85rem', color: '#0f172a',
  marginBottom: 10, paddingBottom: 6,
  borderBottom: '1px solid #f1f5f9',
}

/* ── Checkbox / Radio shared style ────────────────────────────────── */
const labelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '6px 0', cursor: 'pointer',
  fontSize: '0.82rem', color: '#334155',
  fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  accentColor: '#f97316', width: 16, height: 16, flexShrink: 0,
}

/* ── Component ────────────────────────────────────────────────────── */
export default function ProductFilters({
  filters,
  availableCategories,
  availableShops,
  onChange,
  onClose,
  drawer,
  onSubmit,
}: ProductFiltersProps) {
  // Local editable copy so user can batch changes
  const [local, setLocal] = useState<FilterState>(filters)

  // Sync when external filters change (e.g. URL popstate)
  useEffect(() => {
    setLocal(filters)
  }, [filters])

  // Helper: update local state
  const update = (patch: Partial<FilterState>) =>
    setLocal(prev => ({ ...prev, ...patch }))

  // Toggle a category in the array
  const toggleCategory = (cat: string) => {
    setLocal(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat],
    }))
  }

  // Toggle a shop in the array
  const toggleShop = (id: string) => {
    setLocal(prev => ({
      ...prev,
      shops: prev.shops.includes(id)
        ? prev.shops.filter(s => s !== id)
        : [...prev.shops, id],
    }))
  }

  // Apply locally — for drawer mode, user can batch-apply
  const apply = () => {
    onChange(local)
    onSubmit?.()
    if (onClose) onClose()
  }

  // Count active filters for mobile button
  const activeCount = [
    filters.categories.length,
    filters.shops.length,
    filters.minPrice ? 1 : 0,
    filters.maxPrice ? 1 : 0,
    filters.minRating > 0 ? 1 : 0,
    filters.availability !== 'all' ? 1 : 0,
    filters.maxDistance > 0 ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: drawer ? 0 : undefined }}>
      {/* ── Search ──────────────────────────────────────────── */}
      <div>
        <div style={sectionHeader}>Search</div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
            <SearchIcon />
          </span>
          <input
            value={local.q}
            onChange={e => update({ q: e.target.value })}
            placeholder="Search products…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px',
              border: '1.5px solid #e2e8f0', borderRadius: 10,
              fontSize: '0.85rem', outline: 'none', background: '#f8fafc',
              color: '#1e293b',
            }}
          />
        </div>
      </div>

      {/* ── Categories ───────────────────────────────────────── */}
      {availableCategories.length > 0 && (
        <div>
          <div style={sectionHeader}>Category</div>
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {availableCategories.map(cat => (
              <label key={cat} style={labelStyle}>
                <input
                  type="checkbox"
                  checked={local.categories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  style={inputStyle}
                />
                {cat}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Price Range ─────────────────────────────────────── */}
      <div>
        <div style={sectionHeader}>Price Range</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="number"
            min={0}
            placeholder="Min"
            value={local.minPrice}
            onChange={e => update({ minPrice: e.target.value })}
            style={{
              flex: 1, padding: '8px 10px', border: '1.5px solid #e2e8f0',
              borderRadius: 8, fontSize: '0.82rem', outline: 'none',
              background: '#f8fafc', color: '#1e293b', width: '100%', boxSizing: 'border-box',
            }}
          />
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>—</span>
          <input
            type="number"
            min={0}
            placeholder="Max"
            value={local.maxPrice}
            onChange={e => update({ maxPrice: e.target.value })}
            style={{
              flex: 1, padding: '8px 10px', border: '1.5px solid #e2e8f0',
              borderRadius: 8, fontSize: '0.82rem', outline: 'none',
              background: '#f8fafc', color: '#1e293b', width: '100%', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* ── Shop Filter ─────────────────────────────────────── */}
      {availableShops.length > 0 && (
        <div>
          <div style={sectionHeader}>Shop</div>
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {availableShops.map(shop => (
              <label key={shop.id} style={labelStyle}>
                <input
                  type="checkbox"
                  checked={local.shops.includes(shop.id)}
                  onChange={() => toggleShop(shop.id)}
                  style={inputStyle}
                />
                {shop.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Rating ──────────────────────────────────────────── */}
      <div>
        <div style={sectionHeader}>Minimum Rating</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {RATING_OPTIONS.map(opt => (
            <label key={opt.value} style={labelStyle}>
              <input
                type="radio"
                name="rating-filter"
                checked={local.minRating === opt.value}
                onChange={() => update({ minRating: opt.value })}
                style={inputStyle}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* ── Availability ────────────────────────────────────── */}
      <div>
        <div style={sectionHeader}>Availability</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {AVAIL_OPTIONS.map(opt => (
            <label key={opt.value} style={labelStyle}>
              <input
                type="radio"
                name="avail-filter"
                checked={local.availability === opt.value}
                onChange={() => update({ availability: opt.value })}
                style={inputStyle}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* ── Distance ────────────────────────────────────────── */}
      <div>
        <div style={sectionHeader}>Distance</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {DISTANCE_OPTIONS.map(opt => (
            <label key={opt.value} style={labelStyle}>
              <input
                type="radio"
                name="dist-filter"
                checked={local.maxDistance === opt.value}
                onChange={() => update({ maxDistance: opt.value })}
                style={inputStyle}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* ── Apply / Close buttons ───────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        {drawer && (
          <button
            onClick={apply}
            style={{
              flex: 1, padding: '12px 0',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: 'white', border: 'none', borderRadius: 10,
              fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
            }}
          >
            Apply Filters {activeCount > 0 ? `(${activeCount})` : ''}
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: '12px 20px',
              background: '#f1f5f9', color: '#334155',
              border: 'none', borderRadius: 10,
              fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
            }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  )

  // ── Drawer mode (overlay from bottom) ─────────────────────────────
  if (drawer) {
    return (
      <>
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            zIndex: 998, animation: 'fadeIn 0.2s ease',
          }}
        />
        <div
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999,
            background: 'white', borderRadius: '20px 20px 0 0',
            maxHeight: '85vh', overflowY: 'auto',
            padding: '20px 20px 30px',
            animation: 'slideUp 0.3s ease',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
          }}
        >
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 2 }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>Filters</span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
            >
              <XIcon />
            </button>
          </div>

          {content}
        </div>
        <style>{`
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </>
    )
  }

  // ── Inline / sidebar mode ─────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>Filters</span>
      </div>
      {content}
    </div>
  )
}
