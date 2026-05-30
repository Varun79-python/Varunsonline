'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCustomerLocation } from '@/components/customer/useCustomerLocation'
import ProductCard from '@/components/customer/ProductCard'
import FilterChips from '@/components/customer/FilterChips'
import ProductFilters from '@/components/customer/ProductFilters'
import type { FilterState } from '@/components/customer/ProductFilters'

/* ── SVG Icons ────────────────────────────────────────────────────── */
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const SlidersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
  </svg>
)
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
)
const ChevronLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
)
const ChevronRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
)

/* ── Sorting options ──────────────────────────────────────────────── */
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'highest_rated', label: 'Highest Rated' },
  { value: 'most_popular', label: 'Most Popular' },
  { value: 'nearest', label: 'Nearest Shop' },
]

/* ── Response type from API ───────────────────────────────────────── */
interface ProductData {
  id: string
  name: string
  description?: string | null
  price: number
  mrp: number
  discount_percent?: number | null
  image_url?: string | null
  unit?: string | null
  stock_quantity: number
  rating?: number | null
  total_ratings?: number | null
  category?: string | null
  shop: {
    id: string
    name: string
    shop_image_url?: string | null
    city?: string | null
    is_open?: boolean | null
  }
}

interface ApiResponse {
  products: ProductData[]
  total: number
  page: number
  per_page: number
  total_pages: number
  available_categories: string[]
  available_shops: { id: string; name: string }[]
}

/* ── Default filter state (mirrors URL search params) ─────────────── */
function filtersFromParams(sp: URLSearchParams): FilterState {
  return {
    q: sp.get('q') || '',
    categories: sp.get('cat') ? sp.get('cat')!.split(',').filter(Boolean) : [],
    shops: sp.get('shops') ? sp.get('shops')!.split(',').filter(Boolean) : [],
    minPrice: sp.get('min_p') || '',
    maxPrice: sp.get('max_p') || '',
    minRating: sp.has('min_r') ? Number(sp.get('min_r')) : 0,
    availability: (sp.get('avail') as FilterState['availability']) || 'all',
    maxDistance: sp.has('dist') ? Number(sp.get('dist')) : 0,
    sort: sp.get('sort') || 'relevance',
  }
}

function filtersToParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.categories.length > 0) p.set('cat', f.categories.join(','))
  if (f.shops.length > 0) p.set('shops', f.shops.join(','))
  if (f.minPrice) p.set('min_p', f.minPrice)
  if (f.maxPrice) p.set('max_p', f.maxPrice)
  if (f.minRating > 0) p.set('min_r', String(f.minRating))
  if (f.availability !== 'all') p.set('avail', f.availability)
  if (f.maxDistance > 0) p.set('dist', String(f.maxDistance))
  if (f.sort !== 'relevance') p.set('sort', f.sort)
  return p
}

/* ── Main Page ────────────────────────────────────────────────────── */
export default function BrowsePage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()!

  // ── State ───────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>(() => filtersFromParams(searchParams))
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { latitude, longitude, loading: gpsLoading } = useCustomerLocation()
  const supabase = createClient()

  // Load saved address GPS (no live browser capture).
  // Products load immediately without GPS; re-fetch once saved GPS resolves.
  const [gpsApplied, setGpsApplied] = useState(false)
  useEffect(() => {
    if (gpsLoading || gpsApplied) return
    if (latitude != null && longitude != null) {
      fetchProducts(filters, latitude, longitude)
    }
    setGpsApplied(true)
  }, [latitude, longitude, gpsLoading, gpsApplied]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch products from API
  const fetchProducts = useCallback(async (f: FilterState, lat?: number | null, lng?: number | null) => {
    setLoading(true)
    setError(null)

    const params = filtersToParams(f)
    // Page defaults to 1 when filters change
    if (!params.has('page')) params.set('page', '1')

    // Use provided coords, or fall back to hook state
    const useLat = lat != null ? lat : latitude
    const useLng = lng != null ? lng : longitude
    if (useLat != null && useLng != null) {
      params.set('lat', String(useLat))
      params.set('lng', String(useLng))
    }

    try {
      const res = await fetch(`/api/customer/products?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `HTTP ${res.status}`)
      }
      const json: ApiResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [latitude, longitude])

  // Initial fetch immediately (no GPS needed for first load)
  useEffect(() => {
    fetchProducts(filters)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync URL from filters
  const syncUrl = useCallback((f: FilterState) => {
    const params = filtersToParams(f)
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [router, pathname])

  // Handle filter changes from ProductFilters drawer/sidebar
  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters)
    syncUrl(newFilters)
    fetchProducts(newFilters)
  }, [syncUrl, fetchProducts])

  // Handle sort change
  const handleSortChange = useCallback((sort: string) => {
    const updated = { ...filters, sort }
    setFilters(updated)
    syncUrl(updated)
    fetchProducts(updated)
  }, [filters, syncUrl, fetchProducts])

  // Handle removing a single chip
  const handleRemoveChip = useCallback((key: string, value?: string) => {
    const updated = { ...filters }
    switch (key) {
      case 'q':
        updated.q = ''
        break
      case 'cat':
        updated.categories = updated.categories.filter(c => c !== value)
        break
      case 'shops':
        updated.shops = updated.shops.filter(s => s !== value)
        break
      case 'min_p':
        updated.minPrice = ''
        break
      case 'max_p':
        updated.maxPrice = ''
        break
      case 'min_r':
        updated.minRating = 0
        break
      case 'avail':
        updated.availability = 'all'
        break
      case 'dist':
        updated.maxDistance = 0
        break
    }
    setFilters(updated)
    syncUrl(updated)
    fetchProducts(updated)
  }, [filters, syncUrl, fetchProducts])

  // Clear all filters
  const handleClearAll = useCallback(() => {
    const cleared: FilterState = {
      q: '', categories: [], shops: [], minPrice: '', maxPrice: '',
      minRating: 0, availability: 'all', maxDistance: 0, sort: 'relevance',
    }
    setFilters(cleared)
    syncUrl(cleared)
    fetchProducts(cleared)
  }, [syncUrl, fetchProducts])

  // Go to page
  const goToPage = useCallback((page: number) => {
    const params = filtersToParams(filters)
    params.set('page', String(page))
    if (latitude != null && longitude != null) {
      params.set('lat', String(latitude))
      params.set('lng', String(longitude))
    }
    setLoading(true)
    fetch(`/api/customer/products?${params.toString()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then((json: ApiResponse) => {
        setData(json)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [filters, latitude, longitude, pathname, router])

  // Shop name map for chips
  const shopNameMap: Record<string, string> = {}
  if (data) {
    for (const s of data.available_shops) shopNameMap[s.id] = s.name
  }

  // Build active filters for chips
  const activeFilters = {
    q: filters.q,
    categories: filters.categories,
    shops: filters.shops,
    minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
    minRating: filters.minRating,
    availability: filters.availability,
    maxDistance: filters.maxDistance || undefined,
    sort: filters.sort,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 0 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── Sticky top bar ──────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'white', borderBottom: '1px solid #f1f5f9' }}>
        {/* Search bar row */}
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: 'none', border: 'none', color: '#0f172a',
              cursor: 'pointer', padding: 4, display: 'flex',
            }}
          >
            <ChevronLeftIcon />
          </button>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
              <SearchIcon />
            </span>
            <input
              value={filters.q}
              onChange={e => {
                const updated = { ...filters, q: e.target.value }
                setFilters(updated)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleFilterChange(filters)
                }
              }}
              placeholder="Search products across all shops…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 36px 10px 36px',
                border: '1.5px solid #e2e8f0', borderRadius: 12,
                fontSize: '0.88rem', outline: 'none',
                background: '#f8fafc', color: '#1e293b',
              }}
            />
            {filters.q && (
              <button
                onClick={() => {
                  const updated = { ...filters, q: '' }
                  setFilters(updated)
                  handleFilterChange(updated)
                }}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
                  display: 'flex', padding: 4,
                }}
              >
                <XIcon />
              </button>
            )}
          </div>
        </div>

        {/* Sort + Filter row */}
        <div style={{ padding: '0 16px 10px', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Sort dropdown */}
          <div style={{ flex: 1 }}>
            <select
              value={filters.sort}
              onChange={e => handleSortChange(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px',
                border: '1.5px solid #e2e8f0', borderRadius: 10,
                fontSize: '0.82rem', fontWeight: 500, color: '#1e293b',
                background: '#f8fafc', outline: 'none', cursor: 'pointer',
              }}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Mobile filter button */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', border: '1.5px solid #e2e8f0',
              borderRadius: 10, background: '#f8fafc',
              color: '#0f172a', fontWeight: 600, fontSize: '0.82rem',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <SlidersIcon />
            Filters
            {activeFilters.categories.length + activeFilters.shops.length +
              (activeFilters.minPrice ? 1 : 0) + (activeFilters.maxPrice ? 1 : 0) +
              (filters.minRating > 0 ? 1 : 0) +
              (filters.availability !== 'all' ? 1 : 0) +
              (filters.maxDistance ? 1 : 0) > 0 && (
              <span style={{
                background: '#f97316', color: 'white', fontSize: '0.7rem',
                fontWeight: 700, borderRadius: 10, padding: '1px 6px',
                minWidth: 18, textAlign: 'center',
              }}>
                {activeFilters.categories.length + activeFilters.shops.length +
                  (activeFilters.minPrice ? 1 : 0) + (activeFilters.maxPrice ? 1 : 0) +
                  (filters.minRating > 0 ? 1 : 0) +
                  (filters.availability !== 'all' ? 1 : 0) +
                  (filters.maxDistance ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Filter chips */}
        <div style={{ padding: '0 16px 10px' }}>
          <FilterChips
            filters={activeFilters}
            shopNames={shopNameMap}
            onRemove={handleRemoveChip}
            onClearAll={handleClearAll}
          />
        </div>
      </div>

      {/* ── Results area ─────────────────────────────────────────── */}
      <div style={{ padding: '8px 16px 24px' }}>
        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{
              width: 40, height: 40, border: '4px solid #e2e8f0',
              borderTopColor: '#f97316', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{
            textAlign: 'center', padding: '40px 20px', color: '#dc2626',
            background: '#fef2f2', borderRadius: 16, marginTop: 8,
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⚠️</div>
            <div style={{ fontWeight: 600 }}>{error}</div>
            <button
              onClick={() => fetchProducts(filters)}
              style={{
                marginTop: 12, padding: '8px 20px', border: '1px solid #dc2626',
                borderRadius: 8, background: 'white', color: '#dc2626',
                fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && data && data.products.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px', color: '#64748b',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f172a', marginBottom: 6 }}>
              No products found
            </div>
            <p style={{ fontSize: '0.88rem', marginBottom: 20, maxWidth: 300, margin: '0 auto 20px' }}>
              Try adjusting your filters or search term.
            </p>
            <button
              onClick={handleClearAll}
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                color: 'white', border: 'none', borderRadius: 10,
                fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem',
              }}
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Results count */}
        {!loading && data && data.products.length > 0 && (
          <div style={{
            fontSize: '0.82rem', color: '#64748b', marginBottom: 12, fontWeight: 500,
          }}>
            {data.total} product{data.total !== 1 ? 's' : ''} found
          </div>
        )}

        {/* Product grid */}
        {!loading && data && data.products.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}>
            {data.products.map(product => (
              <div key={product.id} className="fade-in" style={{ animationDelay: '0s' }}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && data && data.total_pages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginTop: 24, padding: '8px 0',
          }}>
            <button
              disabled={data.page <= 1}
              onClick={() => goToPage(data.page - 1)}
              style={{
                padding: '8px 14px', border: '1.5px solid #e2e8f0',
                borderRadius: 10, background: data.page <= 1 ? '#f1f5f9' : 'white',
                color: data.page <= 1 ? '#94a3b8' : '#0f172a',
                fontWeight: 600, fontSize: '0.82rem', cursor: data.page <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <ChevronLeftIcon /> Prev
            </button>

            <span style={{
              fontSize: '0.85rem', fontWeight: 600, color: '#0f172a',
              padding: '0 12px',
            }}>
              Page {data.page} of {data.total_pages}
            </span>

            <button
              disabled={data.page >= data.total_pages}
              onClick={() => goToPage(data.page + 1)}
              style={{
                padding: '8px 14px', border: '1.5px solid #e2e8f0',
                borderRadius: 10, background: data.page >= data.total_pages ? '#f1f5f9' : 'white',
                color: data.page >= data.total_pages ? '#94a3b8' : '#0f172a',
                fontWeight: 600, fontSize: '0.82rem', cursor: data.page >= data.total_pages ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              Next <ChevronRightIcon />
            </button>
          </div>
        )}
      </div>

      {/* ── Mobile filter drawer ─────────────────────────────────── */}
      {drawerOpen && (
        <ProductFilters
          filters={filters}
          availableCategories={data?.available_categories || []}
          availableShops={data?.available_shops || []}
          onChange={handleFilterChange}
          onClose={() => setDrawerOpen(false)}
          drawer
          onSubmit={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Desktop sidebar (hidden on small screens via media query, but we show drawer instead) ── */}
      <style>{`
        @media (min-width: 768px) {
          .browse-layout { display: flex; gap: 24px; }
          .browse-sidebar { width: 260px; flex-shrink: 0; }
          .browse-main { flex: 1; }
        }
        .fade-in { animation: fadeInUp 0.35s ease forwards; opacity: 0; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
