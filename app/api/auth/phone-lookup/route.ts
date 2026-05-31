import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/authMiddleware'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit'

// POST state-changing endpoint

/**
 * Server-side phone-to-email lookup for login.
 * Uses service role key to bypass RLS on the profiles table.
 * Accepts optional `role` parameter (default: 'customer').
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 lookups per minute
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = await checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: 'Too many requests. Please slow down.',
    })
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const { phone, role = 'customer' } = await req.json()
    if (!phone || !/^\d{10,}$/.test(phone)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const validRoles = ['customer', 'shopkeeper', 'delivery', 'admin'] as const
    type ValidRole = typeof validRoles[number]
    if (!validRoles.includes(role as ValidRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('phone', phone)
      .eq('role', role as string)
      .maybeSingle()

    if (profile?.email) {
      return NextResponse.json({ email: profile.email, full_name: profile.full_name })
    }

    const roleLabels: Record<string, string> = { customer: 'customer', shopkeeper: 'shop owner', delivery: 'delivery partner', admin: 'admin' }
    return NextResponse.json({ error: `No ${roleLabels[role as string] || 'account'} found with this phone number.` }, { status: 404 })
  } catch (err) {
    console.error('Phone lookup error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
