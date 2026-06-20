import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/modules/infrastructure/services/logger'

/**
 * This endpoint no longer reveals whether a user exists.
 * It always returns { exists: false } to prevent user enumeration.
 * The actual duplicate detection happens server-side during sign-up,
 * which also returns a generic error to prevent enumeration.
 */
export async function POST(_req: NextRequest) {
  try {
    // Log the request metadata without revealing existence to the caller
    logger.auth('check_user_called', { method: 'POST', path: '/api/auth/check-user' })
    // Always return false — never reveal account existence
    return NextResponse.json({ exists: false })
  } catch (err) {
    logger.error('Check user error:', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
