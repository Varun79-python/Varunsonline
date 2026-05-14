import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server config missing' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const bucket = searchParams.get('bucket')
  const path = searchParams.get('path')

  if (!bucket || !path) {
    return NextResponse.json({ error: 'bucket and path required' }, { status: 400 })
  }

  try {
    // Use service role key directly from Supabase to create signed URL
    const { createClient } = await import('@supabase/supabase-js')
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data, error } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(path, 3600) // 1 hour expiry

    if (error) {
      // If bucket not found or other error, return the original path for fallback
      console.error('Storage sign error:', error)
      return NextResponse.json({ error: error.message, path: `/${bucket}/${path}` }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (err: any) {
    console.error('Sign URL exception:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}