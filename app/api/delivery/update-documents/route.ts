import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, aadharUrl } = body

    if (!userId || !aadharUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabaseAdmin
      .from('delivery_agents')
      .update({ aadhar_url: aadharUrl })
      .eq('id', userId)

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Server error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}