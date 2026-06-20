/**
 * lib/logger.ts
 *
 * Lightweight structured logger for production debugging.
 * Zero external dependencies. Swap body for Sentry/DataDog later.
 *
 * Usage:
 *   import { logger } from '@/modules/infrastructure/services/logger'
 *   logger.error('Failed to process order', { orderId, error: err.message })
 */

type LogLevel = 'info' | 'warn' | 'error'

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry: Record<string, unknown> = {
    t: new Date().toISOString(),
    l: level[0].toUpperCase(),
    m: message,
  }
  if (meta && Object.keys(meta).length > 0) {
    entry.d = meta
  }
  const line = JSON.stringify(entry)
  switch (level) {
    case 'error':
      console.error(line)
      break
    case 'warn':
      console.warn(line)
      break
    case 'info':
      console.log(line)
      break
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),

  // ── Specialized helpers ──────────────────────────────────────

  /** Auth failure — e.g. bad token, wrong role, missing profile */
  auth: (reason: string, meta?: Record<string, unknown>) =>
    log('warn', `auth:${reason}`, meta),

  /** Payment event — create, verify, webhook */
  payment: (event: string, meta?: Record<string, unknown>) =>
    log('info', `pay:${event}`, meta),

  /** Order lifecycle event */
  order: (event: string, orderId: string, meta?: Record<string, unknown>) =>
    log('info', `ord:${event}`, { ...meta, orderId }),
}
