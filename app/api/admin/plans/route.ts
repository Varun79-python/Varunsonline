import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Service-role client — bypasses all RLS (admin only)
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/admin/plans — list ALL plans (active or not)
export async function GET() {
  try {
    const { data, error } = await adminClient()
      .from('subscription_plans')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ plans: data })
  } catch (err) {
    console.error('Plans GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
  }
}

// POST /api/admin/plans — create a new plan
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description, plan_type, fee_percent, monthly_fee, duration_days, is_active } = body
    if (!name || !plan_type) return NextResponse.json({ error: 'Name and plan_type required' }, { status: 400 })

    const { data, error } = await adminClient()
      .from('subscription_plans')
      .insert({ name, description, plan_type, fee_percent: fee_percent || 0, monthly_fee: monthly_fee || 0, duration_days: duration_days || 30, is_active: is_active !== false })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ plan: data })
  } catch (err) {
    console.error('Plans POST error:', err)
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
  }
}

// PATCH /api/admin/plans — update a plan
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Plan ID required' }, { status: 400 })

    const { data, error } = await adminClient()
      .from('subscription_plans')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ plan: data })
  } catch (err) {
    console.error('Plans PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}

// DELETE /api/admin/plans — delete a plan
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Plan ID required' }, { status: 400 })

    const { error } = await adminClient()
      .from('subscription_plans')
      .delete()
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Plans DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
  }
}
