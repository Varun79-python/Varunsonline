export const CUSTOMER_GPS_POOR_ACCURACY_METERS = 100

type GPSLikeError = Error & { code?: number }

const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 20000,
}

const FALLBACK_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 5 * 60 * 1000,
  timeout: 30000,
}

function createGPSError(message: string, code?: number): GPSLikeError {
  const error = new Error(message) as GPSLikeError
  error.code = code
  return error
}

function getBrowserPosition(options: PositionOptions): Promise<GeolocationPosition> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(createGPSError('GPS is not supported on this device.'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

export async function getCustomerGPSPosition(): Promise<GeolocationPosition> {
  try {
    return await getBrowserPosition(HIGH_ACCURACY_OPTIONS)
  } catch (error) {
    const gpsError = error as GPSLikeError

    // Permission denial cannot be fixed by retrying. For timeout/unavailable errors,
    // retry with network/cached location because Android WebView GPS can be slow indoors.
    if (gpsError.code === 1) throw gpsError

    try {
      return await getBrowserPosition(FALLBACK_ACCURACY_OPTIONS)
    } catch (fallbackError) {
      throw fallbackError
    }
  }
}

export function formatCustomerGPSError(error: unknown): string {
  const gpsError = error as Partial<GPSLikeError> | null

  if (gpsError?.code === 1) {
    return 'Permission denied — allow location access in app/browser settings, then try again.'
  }

  if (gpsError?.code === 2) {
    return 'Location unavailable — turn on device Location/GPS and try again near a window or open area.'
  }

  if (gpsError?.code === 3) {
    return 'Location request timed out — turn on Location/GPS and try again.'
  }

  return gpsError?.message || 'GPS failed. Please turn on Location/GPS and try again.'
}

export function isPoorCustomerGPSAccuracy(accuracy: number | null | undefined) {
  return typeof accuracy === 'number' && accuracy > CUSTOMER_GPS_POOR_ACCURACY_METERS
}