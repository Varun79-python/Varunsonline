/**
 * POST /api/admin/coupons — Create a new coupon (admin only, bypasses RLS)
 * GET  /api/admin/coupons — List all coupons (admin only)
 * PATCH /api/admin/coupons — Toggle coupon active status
 * DELETE /api/admin/coupons — Delete a coupon
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

async function verifyAdminToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.substring(7))
  if (!user) return null

  // Check admin role via profiles table OR admin email
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL
  const isAdminRole = profile?.role === 'admin'
  const isAdminEmail = ADMIN_EMAIL && (profile?.email === ADMIN_EMAIL || user.email === ADMIN_EMAIL)

  if (!isAdminRole && !isAdminEmail) return null

  return user.id
}

export async function GET(req: NextRequest) {
  try {
    const userId = await verifyAdminToken(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createAdminClient()
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await verifyAdminToken(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { code, description, discount_type, discount_value, min_order_amount, max_discount, valid_until } = body

    if (!code || discount_value == null) {
      return NextResponse.json({ error: 'Code and discount value are required' }, { status: 400 })
    }

    const supabase = await createAdminClient()
    const { data, error } = await supabase
      .from('coupons')
      .insert({
        code: String(code).toUpperCase(),
        description: description || '',
        discount_type: discount_type || 'percent',
        discount_value: Number(discount_value),
        min_order_amount: Number(min_order_amount || 0),
        max_discount: max_discount ? Number(max_discount) : null,
        valid_until: valid_until || null,
        created_by: userId,
        is_active: true,
        used_count: 0,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await verifyAdminToken(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, is_active } = body

    if (!id) return NextResponse.json({ error: 'Coupon ID is required' }, { status: 400 })

    const supabase = await createAdminClient()
    const { data, error } = await supabase
      .from('coupons')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await verifyAdminToken(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Coupon ID is required' }, { status: 400 })

    const supabase = await createAdminClient()
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
