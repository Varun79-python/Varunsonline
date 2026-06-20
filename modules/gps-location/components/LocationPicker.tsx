'use client'
/**
 * components/LocationPicker.tsx
 * Reusable GPS location picker for Customer and Shopkeeper profiles.
 * Shows saved location, detect button, accuracy badge, map link, and reverse geocoded address.
 */
import { useState } from 'react'
import {
  getGPSPosition,
  reverseGeocode,
  accuracyLabel,
  isAccuracyPoor,
  osmMapUrl,
  googleMapsUrl,
  type GPSError,
} from '@/modules/gps-location/services/gps'

export interface SavedLocation {
  latitude: number
  longitude: number
  accuracy?: number
  formattedAddress?: string
  city?: string
  pincode?: string
}

interface LocationPickerProps {
  /** Currently saved location (from DB) */
  saved: SavedLocation | null
  /** Called when user clicks "Use This Location" with the detected position */
  onUse: (loc: SavedLocation) => void
  /** Called immediately when GPS detect succeeds (before user confirms) */
  onDetected?: (loc: SavedLocation) => void
}

type State = 'idle' | 'detecting' | 'detected' | 'error'

export default function LocationPicker({ saved, onUse, onDetected }: LocationPickerProps) {
  const [state, setState] = useState<State>('idle')
  const [detected, setDetected] = useState<SavedLocation | null>(null)
  const [gpsErr, setGpsErr] = useState<GPSError | null>(null)
  const [geocoding, setGeocoding] = useState(false)

  async function detect() {
    setState('detecting')
    setGpsErr(null)
    setDetected(null)
    try {
      const pos = await getGPSPosition()

      if (isAccuracyPoor(pos.accuracy)) {
        // Still accept but warn user
        console.warn(`[LocationPicker] Poor accuracy ±${Math.round(pos.accuracy)}m`)
      }

      const loc: SavedLocation = {
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
      }

      // Reverse geocode in parallel
      setGeocoding(true)
      try {
        const geo = await reverseGeocode(pos.latitude, pos.longitude)
        loc.formattedAddress = geo.formattedAddress
        loc.city = geo.city
        loc.pincode = geo.pincode
      } finally {
        setGeocoding(false)
      }

      setDetected(loc)
      setState('detected')
      onDetected?.(loc)
    } catch (err) {
      setState('error')
      setGpsErr(err as GPSError)
    }
  }

  function useDetected() {
    if (detected) onUse(detected)
  }

  const displayLoc = state === 'detected' ? detected : saved
  const accInfo = displayLoc?.accuracy ? accuracyLabel(displayLoc.accuracy) : null

  const inputBase: React.CSSProperties = {
    background: '#f8fafc',
    borderRadius: 10,
    border: '1.5px solid #e2e8f0',
    padding: 14,
    marginTop: 12,
  }

  return (
    <div style={inputBase}>
      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#374151', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        📡 GPS Location
        {accInfo && (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: accInfo.bg, color: accInfo.color, marginLeft: 4 }}>
            {accInfo.label}
          </span>
        )}
      </div>

      {/* Saved / Detected Location */}
      {displayLoc ? (
        <div style={{ background: state === 'detected' ? '#eff6ff' : '#f0fdf4', border: `1px solid ${state === 'detected' ? '#bfdbfe' : '#86efac'}`, borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: state === 'detected' ? '#1d4ed8' : '#16a34a', marginBottom: 4 }}>
            {state === 'detected' ? '📍 Detected Location' : '✅ Saved Location'}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#374151', marginBottom: 4 }}>
            {displayLoc.latitude.toFixed(6)}, {displayLoc.longitude.toFixed(6)}
          </div>
          {geocoding && (
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>⏳ Getting address…</div>
          )}
          {displayLoc.formattedAddress && !geocoding && (
            <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4, marginBottom: 4 }}>
              {displayLoc.formattedAddress}
            </div>
          )}
          {(displayLoc.city || displayLoc.pincode) && (
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {[displayLoc.city, displayLoc.pincode].filter(Boolean).join(' — ')}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <a
              href={osmMapUrl(displayLoc.latitude, displayLoc.longitude)}
              target="_blank" rel="noreferrer"
              style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              🗺️ OpenStreetMap
            </a>
            <a
              href={googleMapsUrl(displayLoc.latitude, displayLoc.longitude)}
              target="_blank" rel="noreferrer"
              style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              📌 Google Maps
            </a>
          </div>
        </div>
      ) : (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: '0.78rem', color: '#92400e' }}>
          ⚠️ No location saved yet. Tap &ldquo;Detect&rdquo; to set your GPS location.
        </div>
      )}

      {/* Error message */}
      {state === 'error' && gpsErr && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: '0.78rem', color: '#dc2626', lineHeight: 1.4 }}>
          🚫 {gpsErr.message}
        </div>
      )}

      {/* Poor accuracy warning */}
      {state === 'detected' && detected?.accuracy && isAccuracyPoor(detected.accuracy) && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: '0.78rem', color: '#92400e' }}>
          ⚠️ GPS accuracy is low (±{Math.round(detected.accuracy)}m). Move to an open area and try again for better precision.
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={detect}
          disabled={state === 'detecting'}
          style={{
            flex: 1,
            background: state === 'detecting' ? '#f1f5f9' : 'linear-gradient(135deg, #f97316, #ea580c)',
            color: state === 'detecting' ? '#94a3b8' : 'white',
            border: 'none', borderRadius: 9,
            padding: '11px 14px',
            fontWeight: 700, fontSize: '0.82rem',
            cursor: state === 'detecting' ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {state === 'detecting' ? (
            <>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #94a3b8', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Detecting GPS…
            </>
          ) : '📍 Detect Current Location'}
        </button>

        {state === 'detected' && detected && (
          <button
            onClick={useDetected}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: 'white', border: 'none', borderRadius: 9,
              padding: '11px 14px',
              fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
            }}
          >
            ✅ Use This Location
          </button>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
