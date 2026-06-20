import { describe, it, expect } from 'vitest'
import {
  isValidLatitude,
  isValidLongitude,
  validateCoordinates,
  isAccuracyPoor,
  accuracyLabel,
  osmMapUrl,
  googleMapsUrl,
} from './gps'

describe('isValidLatitude', () => {
  it('accepts valid latitudes', () => {
    expect(isValidLatitude(0)).toBe(true)
    expect(isValidLatitude(90)).toBe(true)
    expect(isValidLatitude(-90)).toBe(true)
    expect(isValidLatitude(12.3456)).toBe(true)
  })

  it('rejects out-of-range latitudes', () => {
    expect(isValidLatitude(90.1)).toBe(false)
    expect(isValidLatitude(-90.1)).toBe(false)
    expect(isValidLatitude(180)).toBe(false)
  })

  it('rejects NaN, null, undefined, non-number', () => {
    expect(isValidLatitude(NaN)).toBe(false)
    expect(isValidLatitude(Infinity)).toBe(false)
  })
})

describe('isValidLongitude', () => {
  it('accepts valid longitudes', () => {
    expect(isValidLongitude(0)).toBe(true)
    expect(isValidLongitude(180)).toBe(true)
    expect(isValidLongitude(-180)).toBe(true)
  })

  it('rejects out-of-range longitudes', () => {
    expect(isValidLongitude(180.1)).toBe(false)
    expect(isValidLongitude(-180.1)).toBe(false)
  })

  it('rejects NaN', () => {
    expect(isValidLongitude(NaN)).toBe(false)
  })
})

describe('validateCoordinates', () => {
  it('returns valid for valid coords', () => {
    expect(validateCoordinates(12.34, 56.78)).toEqual({ valid: true })
  })

  it('returns error for invalid latitude', () => {
    const r = validateCoordinates(100, 0)
    if (r.valid) throw new Error('expected invalid')
    expect(r.error).toContain('Invalid latitude')
  })

  it('returns error for invalid longitude', () => {
    const r = validateCoordinates(0, -200)
    if (r.valid) throw new Error('expected invalid')
    expect(r.error).toContain('Invalid longitude')
  })
})

describe('isAccuracyPoor', () => {
  it('returns false for good accuracy', () => {
    expect(isAccuracyPoor(10)).toBe(false)
    expect(isAccuracyPoor(100)).toBe(false)
  })

  it('returns true for poor accuracy', () => {
    expect(isAccuracyPoor(101)).toBe(true)
    expect(isAccuracyPoor(500)).toBe(true)
  })
})

describe('accuracyLabel', () => {
  it('returns green for <20m', () => {
    const r = accuracyLabel(15)
    expect(r.color).toBe('#16a34a')
    expect(r.label).toContain('15m')
  })

  it('returns red for >=100m', () => {
    const r = accuracyLabel(200)
    expect(r.color).toBe('#dc2626')
    expect(r.label).toContain('200m')
  })
})

describe('osmMapUrl / googleMapsUrl', () => {
  it('generates correct OSM URL', () => {
    const url = osmMapUrl(12.34, 56.78)
    expect(url).toContain('mlat=12.34')
    expect(url).toContain('mlon=56.78')
  })

  it('generates correct Google Maps URL', () => {
    const url = googleMapsUrl(12.34, 56.78)
    expect(url).toBe('https://maps.google.com/?q=12.34,56.78')
  })
})
