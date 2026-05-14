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
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // Ensure cookies work across all paths
              path: options?.path || '/',
            })
          )
        },
      },
    }
  )

  // Refresh session — call getUser to refresh token from cookies, then getSession for the current session
  await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()

  // Re-create response after session refresh to pick up any new cookies
  supabaseResponse = NextResponse.next({ request })

  // Add security headers
  supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  supabaseResponse.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.razorpay.com https://garxraczisrnmvvnotyu.supabase.co; frame-src https://checkout.razorpay.com;"
  )

  // ── Protect /admin routes ──────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return supabaseResponse

    if (!session?.user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    const user = session.user
    const isAdminEmail = user.email === ADMIN_EMAIL
    const metaRole = user.user_metadata?.role || user.app_metadata?.role

    if (isAdminEmail || metaRole === 'admin') return supabaseResponse

    try {
      const supabaseSvc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
      const { data: profile } = await supabaseSvc.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (!profile || profile.role !== 'admin') {
        return NextResponse.redirect(new URL('/admin/login', request.url))
      }
    } catch {
      if (!isAdminEmail) return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    return supabaseResponse
  }

  // ── Protect /shopkeeper and /shopkeeper/* routes ──────────────────────
  if (pathname.startsWith('/shopkeeper')) {
    // Allow login pages — never redirect authenticated users back to login
    if (
      pathname === '/shopkeeper/register' ||
      pathname === '/login/shopkeeper' ||
      pathname.startsWith('/login/shopkeeper/')
    ) {
      return supabaseResponse
    }

    if (!session?.user) {
      return NextResponse.redirect(new URL('/login/shopkeeper', request.url))
    }

    const user = session.user
    const metaRole = user.user_metadata?.role || user.app_metadata?.role

    if (metaRole === 'shopkeeper') return supabaseResponse

    try {
      const supabaseSvc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
      const { data: profile } = await supabaseSvc.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle()
      if (profile?.role === 'shopkeeper') return supabaseResponse
    } catch (profileError) {
      console.error('Profile check error in shopkeeper middleware:', profileError)
    }

    return NextResponse.redirect(new URL('/login/shopkeeper', request.url))
  }

  // ── Protect /delivery and /delivery/* routes ──────────────────────────
  if (pathname.startsWith('/delivery') && !pathname.startsWith('/login/delivery')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login/delivery', request.url))
    }

    const user = session.user
    const metaRole = user.user_metadata?.role || user.app_metadata?.role

    if (metaRole === 'delivery_agent') return supabaseResponse

    try {
      const supabaseSvc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
      const { data: profile } = await supabaseSvc.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role === 'delivery_agent') return supabaseResponse
    } catch {
      return NextResponse.redirect(new URL('/login/delivery', request.url))
    }

    return NextResponse.redirect(new URL('/login/delivery', request.url))
  }

  // ── Protect /customer and /customer/* routes ────────────────────────
  if (pathname.startsWith('/customer') && !pathname.startsWith('/login/customer')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const user = session.user
    const metaRole = user.user_metadata?.role || user.app_metadata?.role

    if (metaRole === 'customer') return supabaseResponse

    try {
      const supabaseSvc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
      const { data: profile } = await supabaseSvc.from('profiles').select('role').eq('id', user.id).maybeSingle()
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