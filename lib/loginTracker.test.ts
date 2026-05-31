/**
 * lib/loginTracker.test.ts
 *
 * Unit tests for login tracking and account lockout logic.
 *
 * Tests the lockout calculation, threshold logic, and utility functions.
 * Supabase interactions are mocked since they require a real database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase-js createClient before importing the module under test
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
    rpc: vi.fn(),
  })),
}))

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    auth: vi.fn(),
    payment: vi.fn(),
    order: vi.fn(),
  },
}))

// Set env vars before importing
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

import {
  getLockoutPolicy,
  checkAccountLockout,
  handleFailedLogin,
  handleSuccessfulLogin,
} from './loginTracker'

describe('getLockoutPolicy', () => {
  it('returns standard thresholds for customer role', () => {
    const policy = getLockoutPolicy('customer')
    expect(policy).toContain('5 failures')
    expect(policy).toContain('10 failures')
    expect(policy).toContain('15 failures')
    expect(policy).toContain('15 min')
    expect(policy).toContain('1 hr')
    expect(policy).toContain('24 hr')
  })

  it('returns standard thresholds for shopkeeper role', () => {
    const policy = getLockoutPolicy('shopkeeper')
    expect(policy).toContain('5 failures')
    expect(policy).toContain('10 failures')
    expect(policy).toContain('15 failures')
  })

  it('returns standard thresholds for delivery role', () => {
    const policy = getLockoutPolicy('delivery')
    expect(policy).toContain('5 failures')
    expect(policy).toContain('10 failures')
    expect(policy).toContain('15 failures')
  })

  it('returns stricter thresholds for admin role', () => {
    const policy = getLockoutPolicy('admin')
    expect(policy).toContain('3 failures')
    expect(policy).toContain('5 failures')
    expect(policy).not.toContain('10 failures')
    expect(policy).not.toContain('15 failures')
    expect(policy).not.toContain('24 hr')
  })
})

describe('checkAccountLockout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns locked: false for empty email', async () => {
    const result = await checkAccountLockout('', 'customer')
    expect(result.locked).toBe(false)
  })

  it('returns locked: false when no profile found', async () => {
    // Mock the profile query to return no data
    const { createClient } = await import('@supabase/supabase-js')
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    const result = await checkAccountLockout('nonexistent@test.com', 'customer')
    expect(result.locked).toBe(false)
  })

  it('returns locked: true when account is locked', async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    
    const { createClient } = await import('@supabase/supabase-js')
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { failed_login_count: 5, locked_until: futureDate },
      error: null,
    })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    const result = await checkAccountLockout('locked@test.com', 'customer')
    expect(result.locked).toBe(true)
    expect(result.reason).toBe('account_locked')
  })

  it('returns locked: false when lockout has expired', async () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString()
    
    const { createClient } = await import('@supabase/supabase-js')
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { failed_login_count: 5, locked_until: pastDate },
      error: null,
    })
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const mockFrom = vi.fn()
      .mockReturnValueOnce({ select: mockSelect }) // for profile query
      .mockReturnValueOnce({ update: mockUpdate }) // for clearing lockout
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    const result = await checkAccountLockout('expired@test.com', 'customer')
    expect(result.locked).toBe(false)
  })
})

describe('handleFailedLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('increments failed_login_count for existing profile', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'user-123', failed_login_count: 2, locked_until: null },
      error: null,
    })
    const mockEqSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce({ insert: mockInsert }) // login_attempts insert
      .mockReturnValueOnce({ select: mockSelect })  // profile query
      .mockReturnValueOnce({ update: mockUpdate })  // profile update
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    await handleFailedLogin({
      email: 'test@test.com',
      role: 'customer',
      failureReason: 'invalid_password',
    })

    // Verify update was called with incremented count
    expect(mockUpdate).toHaveBeenCalled()
    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg.failed_login_count).toBe(3) // 2 + 1
  })

  it('applies 15-min lockout at 5 failures (standard)', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'user-123', failed_login_count: 4, locked_until: null },
      error: null,
    })
    const mockEqSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce({ insert: mockInsert })
      .mockReturnValueOnce({ select: mockSelect })
      .mockReturnValueOnce({ update: mockUpdate })
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    await handleFailedLogin({
      email: 'threshold@test.com',
      role: 'customer',
      failureReason: 'invalid_password',
    })

    expect(mockUpdate).toHaveBeenCalled()
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(updateArg.failed_login_count).toBe(5)
    expect(updateArg.locked_until).toBeDefined()

    // Verify lockout is ~15 minutes
    const lockedUntil = new Date(updateArg.locked_until as string)
    const diffMs = lockedUntil.getTime() - Date.now()
    expect(diffMs).toBeGreaterThan(14 * 60 * 1000) // at least ~14 min
    expect(diffMs).toBeLessThan(16 * 60 * 1000)    // at most ~16 min
  })

  it('applies 1-hour lockout at 10 failures (standard)', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'user-123', failed_login_count: 9, locked_until: null },
      error: null,
    })
    const mockEqSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce({ insert: mockInsert })
      .mockReturnValueOnce({ select: mockSelect })
      .mockReturnValueOnce({ update: mockUpdate })
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    await handleFailedLogin({
      email: 'threshold10@test.com',
      role: 'customer',
      failureReason: 'invalid_password',
    })

    expect(mockUpdate).toHaveBeenCalled()
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(updateArg.failed_login_count).toBe(10)

    const lockedUntil = new Date(updateArg.locked_until as string)
    const diffMs = lockedUntil.getTime() - Date.now()
    expect(diffMs).toBeGreaterThan(59 * 60 * 1000)   // at least ~59 min
    expect(diffMs).toBeLessThan(61 * 60 * 1000)       // at most ~61 min
  })

  it('applies 24-hour lockout at 15 failures (standard)', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'user-123', failed_login_count: 14, locked_until: null },
      error: null,
    })
    const mockEqSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce({ insert: mockInsert })
      .mockReturnValueOnce({ select: mockSelect })
      .mockReturnValueOnce({ update: mockUpdate })
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    await handleFailedLogin({
      email: 'threshold15@test.com',
      role: 'customer',
      failureReason: 'invalid_password',
    })

    expect(mockUpdate).toHaveBeenCalled()
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(updateArg.failed_login_count).toBe(15)

    const lockedUntil = new Date(updateArg.locked_until as string)
    const diffMs = lockedUntil.getTime() - Date.now()
    expect(diffMs).toBeGreaterThan(23 * 60 * 60 * 1000) // at least ~23 hr
    expect(diffMs).toBeLessThan(25 * 60 * 60 * 1000)    // at most ~25 hr
  })

  it('applies 15-min lockout at 3 failures (admin)', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'admin-123', failed_login_count: 2, locked_until: null },
      error: null,
    })
    const mockEqSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce({ insert: mockInsert })
      .mockReturnValueOnce({ select: mockSelect })
      .mockReturnValueOnce({ update: mockUpdate })
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    await handleFailedLogin({
      email: 'admin@test.com',
      role: 'admin',
      failureReason: 'invalid_password',
    })

    expect(mockUpdate).toHaveBeenCalled()
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(updateArg.failed_login_count).toBe(3)
    expect(updateArg.locked_until).toBeDefined()

    const lockedUntil = new Date(updateArg.locked_until as string)
    const diffMs = lockedUntil.getTime() - Date.now()
    expect(diffMs).toBeGreaterThan(14 * 60 * 1000)
    expect(diffMs).toBeLessThan(16 * 60 * 1000)
  })

  it('applies 1-hour lockout at 5 failures (admin)', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'admin-123', failed_login_count: 4, locked_until: null },
      error: null,
    })
    const mockEqSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce({ insert: mockInsert })
      .mockReturnValueOnce({ select: mockSelect })
      .mockReturnValueOnce({ update: mockUpdate })
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    await handleFailedLogin({
      email: 'admin5@test.com',
      role: 'admin',
      failureReason: 'invalid_password',
    })

    expect(mockUpdate).toHaveBeenCalled()
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(updateArg.failed_login_count).toBe(5)

    const lockedUntil = new Date(updateArg.locked_until as string)
    const diffMs = lockedUntil.getTime() - Date.now()
    expect(diffMs).toBeGreaterThan(59 * 60 * 1000)
    expect(diffMs).toBeLessThan(61 * 60 * 1000)
  })

  it('does NOT lockout when failures below threshold', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'user-123', failed_login_count: 1, locked_until: null },
      error: null,
    })
    const mockEqSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce({ insert: mockInsert })
      .mockReturnValueOnce({ select: mockSelect })
      .mockReturnValueOnce({ update: mockUpdate })
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    await handleFailedLogin({
      email: 'low@test.com',
      role: 'customer',
      failureReason: 'invalid_password',
    })

    expect(mockUpdate).toHaveBeenCalled()
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(updateArg.failed_login_count).toBe(2)
    expect(updateArg.locked_until).toBeUndefined()
  })

  it('does nothing when no profile exists (non-existent email)', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockEqSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn()
      .mockReturnValueOnce({ insert: mockInsert }) // login_attempts
      .mockReturnValueOnce({ select: mockSelect })  // profile — returns null
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    // Should not throw
    await expect(handleFailedLogin({
      email: 'ghost@test.com',
      role: 'customer',
      failureReason: 'user_not_found',
    })).resolves.toBeUndefined()
  })
})

describe('handleSuccessfulLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resets counters and updates timestamps', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const mockFrom = vi.fn()
      .mockReturnValueOnce({ insert: mockInsert })
      .mockReturnValueOnce({ update: mockUpdate })
    ;(createClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })

    await handleSuccessfulLogin({
      email: 'success@test.com',
      userId: 'user-123',
      ipAddress: '192.168.1.1',
      role: 'customer',
    })

    expect(mockUpdate).toHaveBeenCalled()
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(updateArg.failed_login_count).toBe(0)
    expect(updateArg.locked_until).toBeNull()
    expect(updateArg.last_login_at).toBeDefined()
    expect(updateArg.last_login_ip).toBe('192.168.1.1')
  })
})
