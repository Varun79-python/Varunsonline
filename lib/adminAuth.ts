import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'venkatavarun79@gmail.com'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function verifyAdmin(request: NextRequest): Promise<{ error?: string; userId?: string; isAdmin: boolean }> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No authorization header', isAdmin: false }
  }

  const token = authHeader.substring(7)
  const supabase = createServiceClient()

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return { error: 'Invalid token', isAdmin: false }
  }

  // Check if admin via email
  if (user.email === ADMIN_EMAIL) {
    return { userId: user.id, isAdmin: true }
  }

  // Check if admin via metadata
  const metaRole = user.user_metadata?.role || user.app_metadata?.role
  if (metaRole === 'admin') {
    return { userId: user.id, isAdmin: true }
  }

  // Check profiles table
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'admin') {
    return { userId: user.id, isAdmin: true }
  }

  return { error: 'Not authorized - admin access required', isAdmin: false }
}

export async function requireAdmin(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (auth.error || !auth.isAdmin) {
    throw new Error(auth.error || 'Admin access required')
  }
  return auth
}