/**
 * lib/gps.ts
 * Reliable GPS helper for both customer and shopkeeper.
 * Handles permissions, timeouts, accuracy rejection, and reverse geocoding.
 */

export interface GPSPosition {
  latitude: number
  longitude: number
  accuracy: number
}

export interface ReverseGeoResult {
  formattedAddress: string
  city: string
  pincode: string
  landmark: string
}

export type GPSErrorType = 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED' | 'POOR_ACCURACY'

export interface GPSError {
  type: GPSErrorType
  message: string
  retryable: boolean
}

const MAX_ACCURACY_METERS = 100

export function getGPSPosition(): Promise<GPSPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const err: GPSError = {
        type: 'NOT_SUPPORTED',
        message: 'GPS is not supported on this browser.',
        retryable: false,
      }
      reject(err)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        console.log(`[GPS] Success: lat=${latitude.toFixed(5)}, lon=${longitude.toFixed(5)}, accuracy=±${Math.round(accuracy)}m`)
        resolve({ latitude, longitude, accuracy })
      },
      (nativeErr) => {
        console.error(`[GPS] Error code=${nativeErr.code}:`, nativeErr.message)
        let err: GPSError
        switch (nativeErr.code) {
          case 1: // PERMISSION_DENIED
            err = {
              type: 'PERMISSION_DENIED',
              message: 'Location access denied. Tap the 🔒 lock icon in your browser address bar → Site Settings → Location → Allow, then tap Retry.',
              retryable: true,
            }
            break
          case 2: // POSITION_UNAVAILABLE
            err = {
              type: 'POSITION_UNAVAILABLE',
              message: 'Location unavailable. Ensure device GPS is turned on and move to an open area.',
              retryable: true,
            }
            break
          case 3: // TIMEOUT
            err = {
              type: 'TIMEOUT',
              message: 'GPS timed out. Make sure you are in an area with clear sky visibility.',
              retryable: true,
            }
            break
          default:
            err = {
              type: 'POSITION_UNAVAILABLE',
              message: 'Unable to get location. Please try again.',
              retryable: true,
            }
        }
        reject(err)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  })
}

/** Returns true if GPS accuracy is too poor to use */
export function isAccuracyPoor(accuracy: number): boolean {
  return accuracy > MAX_ACCURACY_METERS
}

/** Accuracy label and colour */
export function accuracyLabel(accuracy: number): { label: string; color: string; bg: string } {
  const m = Math.round(accuracy)
  if (m < 20)  return { label: `✓ ±${m}m`, color: '#16a34a', bg: '#f0fdf4' }
  if (m < 50)  return { label: `±${m}m`,   color: '#d97706', bg: '#fef3c7' }
  if (m < 100) return { label: `⚠ ±${m}m`, color: '#ea580c', bg: '#fff7ed' }
  return             { label: `❌ ±${m}m`,  color: '#dc2626', bg: '#fef2f2' }
}

/** OpenStreetMap reverse geocode */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeoResult> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'VarunsOnline/1.0' } }
    )
    if (!res.ok) throw new Error('Geocode request failed')
    const data = await res.json()
    const addr = data.address || {}

    const city =
      addr.city || addr.town || addr.village || addr.county || addr.state_district || ''
    const pincode = addr.postcode || ''
    const landmark =
      addr.amenity || addr.tourism || addr.building || addr.neighbourhood || ''
    const formattedAddress = data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`

    return { formattedAddress, city, pincode, landmark }
  } catch {
    console.warn('[GPS] Reverse geocode failed — using coordinates only')
    return {
      formattedAddress: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      city: '',
      pincode: '',
      landmark: '',
    }
  }
}

/** OSM map URL for a position */
export function osmMapUrl(lat: number, lon: number, zoom = 17): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=${zoom}`
}

/** Google Maps URL */
export function googleMapsUrl(lat: number, lon: number): string {
  return `https://maps.google.com/?q=${lat},${lon}`
}