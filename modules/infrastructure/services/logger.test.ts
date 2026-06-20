import { describe, it, expect, vi } from 'vitest'
import { logger } from './logger'

describe('logger', () => {
  it('info() calls console.log with JSON string', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.info('hello', { key: 'val' })
    expect(spy).toHaveBeenCalledTimes(1)
    const arg = spy.mock.calls[0][0]
    const parsed = JSON.parse(arg)
    expect(parsed.t).toBeDefined()       // timestamp
    expect(parsed.l).toBe('I')            // INFO level
    expect(parsed.m).toBe('hello')
    expect(parsed.d).toEqual({ key: 'val' })
    spy.mockRestore()
  })

  it('warn() calls console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.warn('caution')
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('error() calls console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('boom')
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('auth() logs structured auth failure', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.auth('wrong_role', { userId: 'abc', actualRole: 'customer' })
    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(spy.mock.calls[0][0])
    expect(parsed.m).toBe('auth:wrong_role')
    expect(parsed.d.userId).toBe('abc')
    expect(parsed.l).toBe('W')
    spy.mockRestore()
  })

  it('payment() logs structured payment event', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.payment('order_created', { amount: 499 })
    const parsed = JSON.parse(spy.mock.calls[0][0])
    expect(parsed.m).toBe('pay:order_created')
    expect(parsed.d.amount).toBe(499)
    expect(parsed.l).toBe('I')
    spy.mockRestore()
  })

  it('order() logs structured order event with orderId', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.order('placed', 'ord-123', { total: 299 })
    const parsed = JSON.parse(spy.mock.calls[0][0])
    expect(parsed.m).toBe('ord:placed')
    expect(parsed.d.orderId).toBe('ord-123')
    expect(parsed.d.total).toBe(299)
    spy.mockRestore()
  })
})
