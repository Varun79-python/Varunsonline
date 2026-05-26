import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Returns the admin email from a server-only env var.
 * This avoids exposing NEXT_PUBLIC_ADMIN_EMAIL in the client bundle.
 */
export async function GET() {
  const email = process.env.ADMIN_EMAIL || ''
  return NextResponse.json({ email })
}
