import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { shopId, shopPhotoUrl, aadharUrl } = body

    if (!shopId || !shopPhotoUrl || !aadharUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabaseAdmin
      .from('shop_documents')
      .insert({ shop_id: shopId, shop_photo_url: shopPhotoUrl, aadhar_url: aadharUrl })

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Server error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}