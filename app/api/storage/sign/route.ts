import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: NextRequest) {
  // Require authentication — prevent unauthenticated signed URL generation
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    const { createClient } = await import('@supabase/supabase-js')
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data, error } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(path, 3600) // 1 hour expiry

    if (error) {
      console.error('Storage sign error:', error)
      return NextResponse.json({ error: error.message, path: `/${bucket}/${path}` }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (err: unknown) {
    console.error('Sign URL exception:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}