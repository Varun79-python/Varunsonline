// ─────────────────────────────────────────────────────────────────────────────
// GPS Utility — shared across shopkeeper, customer, and delivery agent flows
// ─────────────────────────────────────────────────────────────────────────────

export const GPS_POOR_ACCURACY_METERS = 100

export type GPSLikeError = Error & { code?: number }

const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15000,
}

const FALLBACK_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 3 * 60 * 1000, // 3 min cached is fine for network-based fallback
  timeout: 20000,
}

function createGPSError(message: string, code?: number): GPSLikeError {
  const error = new Error(message) as GPSLikeError
  error.code = code
  return error
}

function getBrowserPosition(options: PositionOptions): Promise<GeolocationPosition> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(createGPSError('GPS is not supported on this device.', 2))
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

/**
 * Pre-check the browser permission state before attempting GPS.
 * Returns 'granted' | 'denied' | 'prompt' | 'unknown'.
 */
async function getPermissionState(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      return result.state as 'granted' | 'denied' | 'prompt'
    }
  } catch {
    // Permissions API not available (some older Android WebViews)
  }
  return 'unknown'
}

/**
 * Main GPS function. Tries high-accuracy first, falls back to network/cached
 * position on timeout or unavailability errors. Throws immediately on denial.
 */
export async function getReliableGPSPosition(): Promise<GeolocationPosition> {
  // Fail-fast: if permission is already explicitly denied, throw immediately
  // instead of waiting for a 15-second timeout.
  const permState = await getPermissionState()
  if (permState === 'denied') {
    throw createGPSError(
      'Location permission denied — please allow location access in your device/browser settings and try again.',
      1
    )
  }

  try {
    return await getBrowserPosition(HIGH_ACCURACY_OPTIONS)
  } catch (error) {
    const gpsError = error as GPSLikeError

    // Permission denial → don't retry
    if (gpsError.code === 1) throw gpsError

    // For timeout (code 3) or unavailable (code 2): retry with network/cached fallback
    return getBrowserPosition(FALLBACK_ACCURACY_OPTIONS)
  }
}

/**
 * Returns a user-friendly error message for any GPS error.
 */
export function formatGPSError(error: unknown): string {
  const gpsError = error as Partial<GPSLikeError> | null

  if (gpsError?.code === 1) {
    return 'Location permission denied — open Settings and allow location access for this app, then tap Retry.'
  }
  if (gpsError?.code === 2) {
    return 'Location unavailable — turn on device GPS/Location and move near a window or open area, then tap Retry.'
  }
  if (gpsError?.code === 3) {
    return 'Location request timed out — turn on device GPS/Location and try again.'
  }
  return gpsError?.message || 'GPS failed — please turn on Location/GPS and try again.'
}

export function isPoorGPSAccuracy(accuracy: number | null | undefined) {
  return typeof accuracy === 'number' && accuracy > GPS_POOR_ACCURACY_METERS
}

/**
 * Returns a short toast-friendly GPS accuracy warning, or null if accuracy is fine.
 */
export function getGPSAccuracyWarning(accuracy: number): string | null {
  if (accuracy > GPS_POOR_ACCURACY_METERS) {
    return `⚠️ GPS accuracy is poor (±${Math.round(accuracy)}m) — move to an open area for better precision.`
  }
  return null
}