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
  maximumAge: 3 * 60 * 1000,
  timeout: 20000,
}

function createGPSError(message: string, code?: number): GPSLikeError {
  const error = new Error(message) as GPSLikeError
  error.code = code
  return error
}

function getBrowserPosition(options: PositionOptions): Promise<GeolocationPosition> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    console.error('[GPS] navigator.geolocation is not available on this device/browser.')
    return Promise.reject(createGPSError('GPS is not supported on this device.', 2))
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

/**
 * Main GPS function. Tries high-accuracy first, falls back to network/cached
 * position on timeout or unavailability errors.
 *
 * NOTE: We intentionally do NOT pre-check navigator.permissions here.
 * The Permissions API can return stale/incorrect state in some Chrome builds
 * and cause false "denied" errors when location is actually allowed.
 * We let getCurrentPosition() be the single source of truth.
 */
export async function getReliableGPSPosition(): Promise<GeolocationPosition> {
  try {
    console.log('[GPS] Requesting high-accuracy position...')
    const pos = await getBrowserPosition(HIGH_ACCURACY_OPTIONS)
    console.log(`[GPS] Success: lat=${pos.coords.latitude.toFixed(5)}, lon=${pos.coords.longitude.toFixed(5)}, accuracy=±${Math.round(pos.coords.accuracy)}m`)
    return pos
  } catch (error) {
    const gpsError = error as GPSLikeError

    const codeLabel =
      gpsError.code === 1 ? 'PERMISSION_DENIED' :
      gpsError.code === 2 ? 'POSITION_UNAVAILABLE' :
      gpsError.code === 3 ? 'TIMEOUT' : 'UNKNOWN'

    console.error(`[GPS] High-accuracy failed (${codeLabel} / code=${gpsError.code}):`, gpsError.message)

    // Permission denial — don't retry, surface immediately
    if (gpsError.code === 1) throw gpsError

    // For TIMEOUT or POSITION_UNAVAILABLE: retry with network/cached fallback
    try {
      console.log('[GPS] Retrying with low-accuracy fallback...')
      const pos = await getBrowserPosition(FALLBACK_ACCURACY_OPTIONS)
      console.log(`[GPS] Fallback success: lat=${pos.coords.latitude.toFixed(5)}, lon=${pos.coords.longitude.toFixed(5)}, accuracy=±${Math.round(pos.coords.accuracy)}m`)
      return pos
    } catch (fallbackErr) {
      const fe = fallbackErr as GPSLikeError
      console.error(`[GPS] Fallback also failed (code=${fe.code}):`, fe.message)
      throw fe
    }
  }
}

/**
 * Returns a user-friendly, specific error message per GeolocationPositionError code.
 */
export function formatGPSError(error: unknown): string {
  const gpsError = error as Partial<GPSLikeError> | null

  console.error('[GPS] Error detail:', { code: gpsError?.code, message: gpsError?.message })

  if (gpsError?.code === 1) {
    // PERMISSION_DENIED
    return 'Location access denied — tap the 🔒 icon in your browser address bar and set Location to "Allow", then try again.'
  }
  if (gpsError?.code === 2) {
    // POSITION_UNAVAILABLE
    return 'Location unavailable — turn on device GPS and move to an open area, then try again.'
  }
  if (gpsError?.code === 3) {
    // TIMEOUT
    return 'Location request timed out — ensure GPS/Location is on and try again.'
  }
  return gpsError?.message || 'Could not get location. Please enable GPS and try again.'
}

export function isPoorGPSAccuracy(accuracy: number | null | undefined) {
  return typeof accuracy === 'number' && accuracy > GPS_POOR_ACCURACY_METERS
}

/**
 * Returns a toast-friendly GPS accuracy warning, or null if accuracy is fine.
 */
export function getGPSAccuracyWarning(accuracy: number): string | null {
  if (accuracy > GPS_POOR_ACCURACY_METERS) {
    return `⚠️ GPS accuracy is low (±${Math.round(accuracy)}m) — move to an open area for better precision.`
  }
  return null
}