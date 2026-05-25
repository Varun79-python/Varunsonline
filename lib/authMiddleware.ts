import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function createServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY)
}

/**
 * CSRF protection: validate Origin header matches the app URL.
 * Call at the start of state-changing API routes (POST, PUT, DELETE).
 * Skips validation if APP_URL is not set (development mode).
 */
export function validateOrigin(request: NextRequest): { valid: boolean; error?: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  // Skip in development — Origin header is often absent/null
  if (!appUrl || appUrl.includes('localhost')) {
    return { valid: true }
  }

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Check Origin first, fall back to Referer
  const source = origin || referer
  if (!source) {
    return { valid: false, error: 'Missing origin header' }
  }

  try {
    const sourceUrl = new URL(source)
    const allowedUrl = new URL(appUrl)
    if (sourceUrl.origin !== allowedUrl.origin) {
      logger.auth('csrf_rejected', { source: sourceUrl.origin, allowed: allowedUrl.origin })
      return { valid: false, error: 'Cross-origin request rejected' }
    }
  } catch {
    return { valid: false, error: 'Invalid origin header' }
  }

  return { valid: true }
}

export async function verifyAdmin(request: NextRequest): Promise<{ error?: string; userId?: string }> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    logger.auth('no_header')
    return { error: 'No authorization header' }
  }
  
  const token = authHeader.substring(7)
  const supabase = createServiceClient()
  
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    logger.auth('bad_token', { reason: error?.message })
    return { error: 'Invalid token' }
  }
  
  // Check if admin via metadata
  const metaRole = user.user_metadata?.role
  if (metaRole === 'admin' || user.email === ADMIN_EMAIL) {
    return { userId: user.id }
  }
  
  // Check profiles table
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    logger.auth('wrong_role', { userId: user.id, actualRole: profile?.role })
    return { error: 'Not authorized - admin access required' }
  }
  
  return { userId: user.id }
}

export async function verifyShopkeeper(request: NextRequest): Promise<{ error?: string; userId?: string; shopId?: string }> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    logger.auth('no_header')
    return { error: 'No authorization header' }
  }
  
  const token = authHeader.substring(7)
  const supabase = createServiceClient()
  
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    logger.auth('bad_token', { reason: error?.message })
    return { error: 'Invalid token' }
  }
  
  // Check if shopkeeper
  const metaRole = user.user_metadata?.role
  if (metaRole !== 'shopkeeper') {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'shopkeeper') {
      logger.auth('wrong_role', { userId: user.id, actualRole: profile?.role })
      return { error: 'Not authorized - shopkeeper access required' }
    }
  }
  
  // Get shop ID (may not exist if registration not complete yet — that's OK for APIs)
  const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', user.id).maybeSingle()
  
  return { userId: user.id, shopId: shop?.id }
}

export async function verifyDeliveryAgent(request: NextRequest): Promise<{ error?: string; userId?: string; agentId?: string }> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    logger.auth('no_header')
    return { error: 'No authorization header' }
  }
  
  const token = authHeader.substring(7)
  const supabase = createServiceClient()
  
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    logger.auth('bad_token', { reason: error?.message })
    return { error: 'Invalid token' }
  }
  
  // Check if delivery agent
  const metaRole = user.user_metadata?.role
  if (metaRole !== 'delivery_agent') {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'delivery_agent') {
      logger.auth('wrong_role', { userId: user.id, actualRole: profile?.role })
      return { error: 'Not authorized - delivery agent access required' }
    }
  }
  
  // Get agent ID
  const { data: agent } = await supabase.from('delivery_agents').select('id').eq('id', user.id).single()
  if (!agent) {
    logger.auth('no_agent_profile', { userId: user.id })
    return { error: 'No agent profile found' }
  }
  
  return { userId: user.id, agentId: agent.id }
}

export async function verifyCustomer(request: NextRequest): Promise<{ error?: string; userId?: string }> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    logger.auth('no_header')
    return { error: 'No authorization header' }
  }
  
  const token = authHeader.substring(7)
  const supabase = createServiceClient()
  
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    logger.auth('bad_token', { reason: error?.message })
    return { error: 'Invalid token' }
  }
  
  const metaRole = user.user_metadata?.role
  if (metaRole === 'customer') return { userId: user.id }
  
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'customer') {
    logger.auth('wrong_role', { userId: user.id, actualRole: profile?.role })
    return { error: 'Not authorized - customer access required' }
  }
  
  return { userId: user.id }
}