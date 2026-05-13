// Simple in-memory rate limiter
// For production, use Redis or similar
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimits = new Map<string, RateLimitEntry>()

const DEFAULT_WINDOW_MS = 60 * 1000 // 1 minute
const DEFAULT_MAX_REQUESTS = 10

export interface RateLimitConfig {
  windowMs?: number
  maxRequests?: number
  message?: string
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {}
): { allowed: boolean; remaining: number; resetTime: number } {
  const windowMs = config.windowMs || DEFAULT_WINDOW_MS
  const maxRequests = config.maxRequests || DEFAULT_MAX_REQUESTS

  const now = Date.now()
  const entry = rateLimits.get(identifier)

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimits.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
    }
  }

  // Existing window
  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  entry.count++
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

export function getRateLimitIdentifier(request: Request | NextRequest): string {
  // Get IP from request - in production, use X-Forwarded-For or real IP
  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
  return ip
}

export function createRateLimitMiddleware(config: RateLimitConfig = {}) {
  return (request: NextRequest) => {
    const identifier = getRateLimitIdentifier(request)
    const result = checkRateLimit(identifier, config)

    if (!result.allowed) {
      return new NextResponse(
        JSON.stringify({ error: config.message || 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
            'Content-Type': 'application/json',
          },
        }
      )
    }

    return null // Continue to handler
  }
}