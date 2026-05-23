import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  // Create Supabase response with cookie handling
  const supabaseResponse = NextResponse.next({ 
    request: {
      headers: requestHeaders,
    }
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, { ...options, path: '/' })
          )
        },
      },
    }
  )

  // Use getSession() to read the JWT from the cookie — no network call, no false logouts.
  // getUser() (network-validated) is reserved for API route handlers where security is critical.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  // Add security headers
  supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  supabaseResponse.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.razorpay.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.razorpay.com https://garxraczisrnmvvnotyu.supabase.co wss://garxraczisrnmvvnotyu.supabase.co; " +
    "frame-src https://checkout.razorpay.com https://api.razorpay.com https://livebutton.razorpay.com;"
  )

  // ── Protect /admin routes ──────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return supabaseResponse

    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    const isAdminEmail = user.email === ADMIN_EMAIL
    const metaRole = user.user_metadata?.role || user.app_metadata?.role

    // Fast path — trust email or metadata role without a DB call
    if (isAdminEmail || metaRole === 'admin') return supabaseResponse

    // Slow path — check profiles table
    try {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role === 'admin') return supabaseResponse
      // Profile exists but not admin — block
      if (profile) return NextResponse.redirect(new URL('/admin/login', request.url))
      // Profile missing — fail open (layout will re-verify)
      return supabaseResponse
    } catch {
      // DB error — fail open, layout will handle it
      return supabaseResponse
    }
  }


  // ── Protect /shopkeeper routes ──────────────────────────────────────────────
  if (pathname.startsWith('/shopkeeper')) {
    if (
      pathname === '/login/shopkeeper' ||
      pathname.startsWith('/login/shopkeeper/')
    ) {
      return supabaseResponse
    }

    if (!user) {
      return NextResponse.redirect(new URL('/login/shopkeeper', request.url))
    }

    const metaRole = user.user_metadata?.role || user.app_metadata?.role

    if (metaRole === 'shopkeeper') return supabaseResponse

    try {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role === 'shopkeeper') return supabaseResponse
    } catch (profileError) {
      console.error('Profile check error in shopkeeper middleware:', profileError)
    }

    return NextResponse.redirect(new URL('/login/shopkeeper', request.url))
  }

  // ── Protect /delivery routes ────────────────────────────────────────────────
  if (pathname.startsWith('/delivery') && !pathname.startsWith('/login/delivery')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login/delivery', request.url))
    }

    const metaRole = user.user_metadata?.role || user.app_metadata?.role

    if (metaRole === 'delivery_agent') return supabaseResponse

    try {
      const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profileError) {
        return NextResponse.redirect(new URL('/login/delivery', request.url))
      }
      if (profile?.role === 'delivery_agent') return supabaseResponse
    } catch {
      return NextResponse.redirect(new URL('/login/delivery', request.url))
    }

    return NextResponse.redirect(new URL('/login/delivery', request.url))
  }

  // ── Protect /customer routes ────────────────────────────────────────────────
  if (pathname.startsWith('/customer') && !pathname.startsWith('/login/customer')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const metaRole = user.user_metadata?.role || user.app_metadata?.role

    if (metaRole === 'customer') return supabaseResponse

    try {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role === 'customer') return supabaseResponse
    } catch {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}