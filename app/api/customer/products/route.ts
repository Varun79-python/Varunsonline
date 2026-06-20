import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/modules/authentication/services/authMiddleware'
import { haversineKm } from '@/modules/gps-location/services/gps'
import { logger } from '@/modules/infrastructure/services/logger'

// Dynamic — user location varies per request.
// Sub-queries (categories, shops list, platform_settings) are cached
// internally via the Supabase client to reduce DB load.

/**
 * GET /api/customer/products
 *
 * Server-side product listing with filtering, sorting, and pagination.
 * Designed for the customer product browse experience.
 *
 * Query params:
 *   q         – text search (name / description)
 *   cat       – comma-separated categories
 *   shops     – comma-separated shop IDs
 *   min_p     – minimum price
 *   max_p     – maximum price
 *   min_r     – minimum rating (0-5)
 *   avail     – 'in_stock' | 'out_of_stock' | 'all'  (default: 'all')
 *   dist      – max distance in km from user
 *   lat       – user latitude  (required if dist or sort=nearest is used)
 *   lng       – user longitude (required if dist or sort=nearest is used)
 *   sort      – 'relevance' | 'price_asc' | 'price_desc' | 'newest' |
 *               'highest_rated' | 'most_popular' | 'nearest'
 *   page      – page number (1-based, default 1)
 *   per_page  – results per page (1-50, default 20)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ── Parse params ──────────────────────────────────────────────────
  const search    = (searchParams.get('q') || '').trim()
  const categories = searchParams.get('cat')
    ? searchParams.get('cat')!.split(',').map(s => s.trim()).filter(Boolean)
    : []
  const shopIdFilter = searchParams.get('shops')
    ? searchParams.get('shops')!.split(',').map(s => s.trim()).filter(Boolean)
    : []
  const minPrice   = searchParams.has('min_p') ? parseFloat(searchParams.get('min_p')!) : undefined
  const maxPrice   = searchParams.has('max_p') ? parseFloat(searchParams.get('max_p')!) : undefined
  const minRating  = searchParams.has('min_r') ? parseFloat(searchParams.get('min_r')!) : undefined
  const availability = (searchParams.get('avail') || 'all') as 'in_stock' | 'out_of_stock' | 'all'
  const maxDistance = searchParams.has('dist') ? parseFloat(searchParams.get('dist')!) : undefined
  const userLat    = searchParams.has('lat') ? parseFloat(searchParams.get('lat')!) : undefined
  const userLng    = searchParams.has('lng') ? parseFloat(searchParams.get('lng')!) : undefined
  const sort       = (searchParams.get('sort') || 'relevance') as string
  const page       = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage    = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '20')))

  // Validate co-ordinates if distance-based filtering is requested
  if ((maxDistance != null || sort === 'nearest') && (userLat == null || userLng == null)) {
    return NextResponse.json(
      { error: 'User location (lat, lng) is required for distance-based filtering or nearest sort' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // ── Step 0: Load admin delivery radius and cap maxDistance ─────────────
  const { data: radiusRow } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'shop_radius_km')
    .maybeSingle()
  const adminRadiusKm = radiusRow ? Number(radiusRow.value) : 10

  // Enforce admin radius as the maximum allowed distance
  let effectiveMaxDistance = maxDistance
  if (effectiveMaxDistance != null) {
    if (effectiveMaxDistance > adminRadiusKm) {
      logger.warn('customer_products_radius_capped', {
        requested: effectiveMaxDistance,
        capped: adminRadiusKm,
      })
      effectiveMaxDistance = adminRadiusKm
    }
  } else {
    // If no distance filter but we have coords, use admin radius as default
    if (userLat != null && userLng != null) {
      effectiveMaxDistance = adminRadiusKm
    }
  }

  try {
    // ── Step 1: Get available categories and shops for the filter UI ─
    const now = new Date().toISOString()
    const [catResult, shopsResult] = await Promise.all([
      supabase
        .from('products')
        .select('category')
        .not('category', 'is', null)
        .neq('category', '')
        .eq('is_available', true),
      supabase
        .from('shops')
        .select('id, name, shop_image_url, latitude, longitude, city, is_open, subscription_end_date')
        .eq('is_approved', true)
        .eq('is_active', true),
    ])

    const availableCategories = [
      ...new Set(
        (catResult.data || [])
          .map(r => r.category)
          .filter((c): c is string => !!c)
      ),
    ].sort()

    interface ShopRow {
      id: string
      name: string
      shop_image_url: string | null
      latitude: number | null
      longitude: number | null
      city: string | null
      is_open: boolean
      subscription_end_date: string | null
    }
    const allShops: ShopRow[] = (shopsResult.data || []) as ShopRow[]
    const nowDate = new Date()

    // ── Step 2: Filter shops by distance + subscription + open status ──
    let qualifyingShopIds: string[]

    qualifyingShopIds = allShops
      .filter(s => {
        // Exclude shops with expired subscriptions
        if (s.subscription_end_date && new Date(s.subscription_end_date) < nowDate) {
          return false
        }
        // Distance filter (only if we have coordinates)
        if (effectiveMaxDistance != null && userLat != null && userLng != null) {
          if (s.latitude == null || s.longitude == null) return false
          const d = haversineKm(userLat, userLng, s.latitude, s.longitude)
          return d <= effectiveMaxDistance
        }
        return true
      })
      .map(s => s.id)

    // Apply explicit shop filter (intersection with distance-qualified shops)
    if (shopIdFilter.length > 0) {
      qualifyingShopIds = qualifyingShopIds.filter(id => shopIdFilter.includes(id))
    }

    if (qualifyingShopIds.length === 0) {
      return NextResponse.json({
        products: [],
        total: 0,
        page,
        per_page: perPage,
        total_pages: 0,
        available_categories: availableCategories,
        available_shops: allShops.map(s => ({ id: s.id, name: s.name })),
      })
    }

    // ── Step 3: Build the product query ────────────────────────────
    // Use `count: 'exact'` only when not sorting by nearest
    const needsExactCount = sort !== 'nearest'

    let query = supabase
      .from('products')
      .select(
        `id, name, description, category, image_url, mrp, price, discount_percent,
         unit, stock_quantity, is_available, is_featured, created_at,
         rating, total_ratings,
         shop:shop_id!inner(id, name, shop_image_url, latitude, longitude, city, is_open)`,
        needsExactCount ? { count: 'exact' } : undefined
      )
      .in('shop_id', qualifyingShopIds)
      .eq('is_available', true)

    // Text search
    if (search) {
      // Use ilike for case-insensitive search on name and description
      const searchTerm = `%${search}%`
      query = query.or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
    }

    // Category filter
    if (categories.length > 0) {
      query = query.in('category', categories)
    }

    // Price range
    if (minPrice != null && !isNaN(minPrice)) {
      query = query.gte('price', minPrice)
    }
    if (maxPrice != null && !isNaN(maxPrice)) {
      query = query.lte('price', maxPrice)
    }

    // Minimum rating
    if (minRating != null && !isNaN(minRating) && minRating > 0) {
      query = query.gte('rating', minRating)
    }

    // Availability
    if (availability === 'in_stock') {
      query = query.gt('stock_quantity', 0)
    } else if (availability === 'out_of_stock') {
      query = query.eq('stock_quantity', 0)
    }

    // Sorting (except nearest which is handled in-memory)
    if (sort === 'nearest') {
      // For nearest sort, fetch a generous batch and sort in-memory later
      query = query.order('created_at', { ascending: false })
      // Remove range limit for nearest — we paginate after sorting
    } else {
      switch (sort) {
        case 'price_asc':
          query = query.order('price', { ascending: true })
          break
        case 'price_desc':
          query = query.order('price', { ascending: false })
          break
        case 'newest':
          query = query.order('created_at', { ascending: false })
          break
        case 'highest_rated':
          query = query.order('rating', { ascending: false, nullsFirst: false })
          break
        case 'most_popular':
          query = query.order('total_ratings', { ascending: false, nullsFirst: false })
          break
        default: // 'relevance'
          query = query.order('created_at', { ascending: false })
      }

      // Pagination
      const from = (page - 1) * perPage
      const to = from + perPage - 1
      query = query.range(from, to)
    }

    // Execute query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: products, count, error } = await query as any

    if (error) {
      logger.error('customer_products_query_error', { error: error.message })
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    let resultProducts = products || []
    let totalCount = count ?? 0

    // ── Nearest sort: sort in-memory, then paginate ────────────────
    if (sort === 'nearest' && userLat != null && userLng != null) {
      // Compute distance for each product using its shop's coordinates
      resultProducts = resultProducts
        .map((p: Record<string, unknown>) => {
          const shop = p.shop as Record<string, unknown> | undefined
          let distance: number | null = null
          if (shop && typeof shop.latitude === 'number' && typeof shop.longitude === 'number') {
            distance = haversineKm(userLat, userLng, shop.latitude, shop.longitude)
          }
          return { ...p, distance }
        })
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
          const da = (a.distance as number) ?? Infinity
          const db = (b.distance as number) ?? Infinity
          return da - db
        })

      totalCount = resultProducts.length
      const from = (page - 1) * perPage
      const to = from + perPage
      resultProducts = resultProducts.slice(from, to)
    }

    // ── Build available shops list for filters ──────────────────────
    const availableShops = allShops.map(s => ({ id: s.id, name: s.name }))

    logger.info('customer_products_success', {
      total: totalCount,
      page,
      perPage,
      sort,
      filters: { search: !!search, categories, minPrice, maxPrice, minRating, availability, maxDistance },
    })

    return NextResponse.json({
      products: resultProducts,
      total: totalCount,
      page,
      per_page: perPage,
      total_pages: Math.ceil(totalCount / perPage) || 0,
      available_categories: availableCategories,
      available_shops: availableShops,
    })
  } catch (err) {
    logger.error('customer_products_error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
