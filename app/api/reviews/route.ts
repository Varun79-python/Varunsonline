import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/authMiddleware'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reviews?shop_id=xxx&limit=10
 * Returns public reviews for a shop, with customer name.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const shopId = searchParams.get('shop_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    if (!shopId) {
      return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        review_text,
        created_at,
        customer_id,
        profiles:customer_id ( full_name )
      `)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Reviews fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
    }

    // Get aggregate stats
    const { data: stats } = await supabase
      .from('shops')
      .select('rating, total_ratings')
      .eq('id', shopId)
      .single()

    return NextResponse.json({
      reviews: (reviews || []).map(r => ({
        id: r.id,
        rating: r.rating,
        text: r.review_text,
        customerName: (r as any).profiles?.full_name || 'Anonymous',
        createdAt: r.created_at,
      })),
      stats: stats ? {
        averageRating: stats.rating,
        totalRatings: stats.total_ratings,
      } : { averageRating: 0, totalRatings: 0 },
    })
  } catch (err) {
    console.error('Reviews GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/**
 * POST /api/reviews
 * Create a review for a shop after a delivered order.
 * Body: { order_id, shop_id, rating, review_text? }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createServiceClient()

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await req.json()
    const { order_id, shop_id, rating, review_text } = body

    if (!order_id || !shop_id || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'order_id, shop_id, and rating (1-5) are required' }, { status: 400 })
    }

    // Verify the order belongs to this customer and is delivered
    const { data: order } = await supabase
      .from('orders')
      .select('id, customer_id, status')
      .eq('id', order_id)
      .eq('customer_id', user.id)
      .eq('status', 'delivered')
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Order not found or not eligible for review' }, { status: 403 })
    }

    // Check if already reviewed
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('order_id', order_id)
      .eq('customer_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Already reviewed this order' }, { status: 409 })
    }

    // Create the review
    const { data: review, error: insertErr } = await supabase
      .from('reviews')
      .insert({
        order_id,
        customer_id: user.id,
        shop_id,
        rating,
        review_text: review_text || null,
      })
      .select()
      .single()

    if (insertErr) {
      console.error('Review insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to create review' }, { status: 500 })
    }

    return NextResponse.json({ success: true, review: { id: review.id } })
  } catch (err) {
    console.error('Reviews POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
