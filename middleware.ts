import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'venkatavarun79@gmail.com'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Create Supabase response with cookie handling
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session on every request
  await supabase.auth.getUser()

  // Add security headers
  supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  supabaseResponse.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.razorpay.com https://garxraczisrnmvvnotyu.supabase.co; frame-src https://checkout.razorpay.com;"
  )

  // Only protect /admin routes
  if (!pathname.startsWith('/admin')) {
    return supabaseResponse
  }

  // Allow access to admin login page
  if (pathname === '/admin/login') {
    return supabaseResponse
  }

  // Get the auth token from cookies or Authorization header
  const authCookie = request.cookies.get('sb-access-token')?.value
  const authHeader = request.headers.get('authorization')
  const token = authCookie || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null)

  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Use service role key to verify token (skip RLS)
    const adminSupabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data: { user }, error } = await adminSupabase.auth.getUser(token)

    if (error || !user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // Check if admin via email or profile role
    const isAdminEmail = user.email === ADMIN_EMAIL
    const metaRole = user.user_metadata?.role || user.app_metadata?.role

    if (isAdminEmail || metaRole === 'admin') {
      return supabaseResponse
    }

    // Check profile table for admin role
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    return supabaseResponse
  } catch (error) {
    console.error('Admin middleware error:', error)
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}