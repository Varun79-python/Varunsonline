/**
 * lib/customerGps.ts
 * Re-exports from lib/gps.ts with customer-friendly aliases.
 * Keeps backward-compatibility for checkout and shop pages.
 */
import { getGPSPosition, isAccuracyPoor, type GPSError } from './gps'

/** Get the customer's current GPS position. Returns { latitude, longitude, accuracy }. */
export async function getCustomerGPSPosition() {
  return getGPSPosition()
}

/** Returns true if GPS accuracy is worse than 100m. */
export function isPoorCustomerGPSAccuracy(accuracyMeters: number): boolean {
  return isAccuracyPoor(accuracyMeters)
}

/** Convert a GPSError (or any unknown thrown value) to a human-readable string. */
export function formatCustomerGPSError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return (err as GPSError).message
  }
  if (err instanceof Error) return err.message
  return 'Unable to get GPS location. Please try again.'
}