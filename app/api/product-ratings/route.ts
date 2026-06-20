import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/modules/authentication/services/authMiddleware'

// Ratings created client-side (app/customer/orders/[id]/page.tsx upsert).
// No revalidate here — keep dynamic to show freshly submitted ratings.

/**
 * GET /api/product-ratings?product_id=xxx&limit=10
 * Returns public product ratings with customer names.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('product_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    if (!productId) {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: ratings, error } = await supabase
      .from('product_ratings')
      .select(`
        id,
        rating,
        review,
        created_at,
        user_id,
        profiles:user_id ( full_name )
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Product ratings fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 })
    }

    // Get aggregate stats
    const { data: product } = await supabase
      .from('products')
      .select('rating, total_ratings')
      .eq('id', productId)
      .single()

    return NextResponse.json({
      ratings: (ratings || []).map(r => ({
        id: r.id,
        rating: r.rating,
        text: r.review,
        customerName: (r as any).profiles?.full_name || 'Anonymous',
        createdAt: r.created_at,
      })),
      stats: product ? {
        averageRating: product.rating,
        totalRatings: product.total_ratings,
      } : { averageRating: 0, totalRatings: 0 },
    })
  } catch (err) {
    console.error('Product ratings GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
