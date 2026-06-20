import { describe, it, expect } from 'vitest'
import { getRateLimitIdentifier } from './rateLimit'

describe('getRateLimitIdentifier', () => {
  it('extracts IP from x-forwarded-for', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.42' },
    })
    expect(getRateLimitIdentifier(req)).toBe('203.0.113.42')
  })

  it('takes first IP when multiple are present', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.1, 203.0.113.5' },
    })
    expect(getRateLimitIdentifier(req)).toBe('10.0.0.1')
  })

  it('returns "unknown" when header is missing', () => {
    const req = new Request('https://example.com')
    expect(getRateLimitIdentifier(req)).toBe('unknown')
  })

  it('handles IPv6 address', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '::1' },
    })
    expect(getRateLimitIdentifier(req)).toBe('::1')
  })
})
