import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'venkatavarun79@gmail.com'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Create response that will have security headers
  const response = NextResponse.next()

  // Security headers for all requests
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // CSP
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.razorpay.com https://garxraczisrnmvvnotyu.supabase.co; frame-src https://checkout.razorpay.com;"
  )

  // Only protect /admin routes
  if (!pathname.startsWith('/admin')) {
    return response
  }

  // Allow access to admin login page
  if (pathname === '/admin/login') {
    return response
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
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // Check if admin via email or profile role
    const isAdminEmail = user.email === ADMIN_EMAIL
    const metaRole = user.user_metadata?.role || user.app_metadata?.role

    if (isAdminEmail || metaRole === 'admin') {
      return response
    }

    // Check profile table for admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    return response
  } catch (error) {
    console.error('Admin middleware error:', error)
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}