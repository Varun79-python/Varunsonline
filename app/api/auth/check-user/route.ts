import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/authMiddleware'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit'

// POST state-changing endpoint

/**
 * Server-side check if a user exists by phone or email (for registration).
 * Uses service role key to bypass RLS on the profiles table.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 20 checks per minute
    const identifier = getRateLimitIdentifier(req)
    const rateCheck = await checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 20,
      message: 'Too many requests. Please slow down.',
    })
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await req.json()
    const phone = body.phone || ''
    const email = body.email || ''

    if (!phone && !email) {
      return NextResponse.json({ error: 'Provide phone or email' }, { status: 400 })
    }

    const supabase = createServiceClient()
    let query = supabase
      .from('profiles')
      .select('id')
      .eq('role', 'customer')

    if (phone) {
      query = query.eq('phone', phone.replace(/\D/g, ''))
    } else if (email) {
      query = query.eq('email', email.toLowerCase().trim())
    }

    const { data: existing } = await query.maybeSingle()

    return NextResponse.json({ exists: !!existing })
  } catch (err) {
    console.error('Check user error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
