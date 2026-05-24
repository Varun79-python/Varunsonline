import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
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
