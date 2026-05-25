import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Edge middleware — protects routes before they reach the browser.
 *
 * Uses Supabase SSR cookies, NOT Bearer tokens (those are for API routes).
 * Role is read from the JWT's user_metadata (set at signup), not the DB.
 * This avoids a cold-start DB query on every request.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
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

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // ── Public / unrestricted paths ─────────────────────────────────
  // API routes (auth via Bearer token), static assets, login, splash
  if (
    path.startsWith('/api/') ||
    path.startsWith('/_next/') ||
    path.startsWith('/login/') ||
    path === '/login' ||
    path === '/splash' ||
    path === '/splash/' ||
    path === '/' ||
    path === '/favicon.ico' ||
    path === '/manifest.json' ||
    path === '/sw.js' ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password')
  ) {
    return supabaseResponse
  }

  // ── Admin routes — require admin role ──────────────────────────
  if (path.startsWith('/admin')) {
    // /admin/login is public (handled above), everything else needs auth
    if (!user) {
      const url = new URL('/admin/login', request.url)
      url.searchParams.set('redirect', path)
      return NextResponse.redirect(url)
    }
    const role = user.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // ── Shopkeeper routes ──────────────────────────────────────────
  if (path.startsWith('/shopkeeper')) {
    if (!user) {
      const url = new URL('/login/shopkeeper', request.url)
      url.searchParams.set('redirect', path)
      return NextResponse.redirect(url)
    }
    const role = user.user_metadata?.role
    if (role !== 'shopkeeper') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // ── Delivery agent routes ──────────────────────────────────────
  if (path.startsWith('/delivery')) {
    if (!user) {
      const url = new URL('/login/delivery', request.url)
      url.searchParams.set('redirect', path)
      return NextResponse.redirect(url)
    }
    const role = user.user_metadata?.role
    if (role !== 'delivery_agent') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // ── Customer routes (profile, orders, checkout) — require customer role ──
  // NOTE: /customer/shop/[id] browsing is NOT protected (public browsing allowed)
  if (path.startsWith('/customer/')) {
    // Allow public shop browsing
    if (path.match(/^\/customer\/shop\//)) {
      return supabaseResponse
    }
    // Other customer pages (checkout, orders, cart, profile) need auth
    if (!user) {
      const url = new URL('/login/customer', request.url)
      url.searchParams.set('redirect', path)
      return NextResponse.redirect(url)
    }
    const role = user.user_metadata?.role
    if (role !== 'customer') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip static files, but match all page routes
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
