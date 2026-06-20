import { NextRequest } from 'next/server'
import { createServiceClient, verifyAdmin as _verifyAdmin } from '@/modules/authentication/services/authMiddleware'

export { createServiceClient }

export async function verifyAdmin(request: NextRequest): Promise<{ error?: string; userId?: string; isAdmin: boolean }> {
  const result = await _verifyAdmin(request)
  return { ...result, isAdmin: !result.error }
}

export async function requireAdmin(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (auth.error || !auth.isAdmin) {
    throw new Error(auth.error || 'Admin access required')
  }
  return auth
}