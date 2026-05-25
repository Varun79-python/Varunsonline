import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    // Require admin auth — this endpoint exposes schema info
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.substring(7))
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Sample a few rows from shop_subscriptions to see columns
    const { data: subData, error: subError } = await supabaseAdmin.from('shop_subscriptions').select('*').limit(1)
    
    // Sample from subscription_plans
    const { data: planData, error: planError } = await supabaseAdmin.from('subscription_plans').select('*').limit(1)

    // Sample from orders
    const { data: orderData, error: orderError } = await supabaseAdmin.from('orders').select('*').limit(1)

    return NextResponse.json({
      shop_subscriptions: { data: subData, error: subError },
      subscription_plans: { data: planData, error: planError },
      orders: { data: orderData, error: orderError }
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) })
  }
}
