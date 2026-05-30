'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SavedAddress {
  id: string
  latitude: number | null
  longitude: number | null
  label: string
  house_name: string
  street_name: string
  city: string | null
}

interface CustomerLocation {
  latitude: number | null
  longitude: number | null
  loading: boolean
  error: string | null
  address: SavedAddress | null
}

/**
 * useCustomerLocation
 *
 * Reads the customer's saved default address GPS from the `addresses` table.
 * No live browser GPS capture — purely from saved data.
 *
 * Call this in any customer page that needs distance-based features
 * (shop discovery, delivery time estimates, distance filters).
 */
export function useCustomerLocation(): CustomerLocation {
  const supabase = createClient()
  const [location, setLocation] = useState<CustomerLocation>({
    latitude: null,
    longitude: null,
    loading: true,
    error: null,
    address: null,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (!cancelled) setLocation(prev => ({ ...prev, loading: false, error: 'Not logged in' }))
          return
        }

        const { data, error } = await supabase
          .from('addresses')
          .select('id, latitude, longitude, label, house_name, street_name, city')
          .eq('customer_id', user.id)
          .order('is_default', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) {
          if (!cancelled) setLocation(prev => ({ ...prev, loading: false, error: error.message }))
          return
        }

        if (data) {
          const addr = data as unknown as SavedAddress
          if (!cancelled) {
            setLocation({
              latitude: addr.latitude,
              longitude: addr.longitude,
              loading: false,
              error: null,
              address: addr,
            })
          }
        } else {
          // No saved addresses — proceed without GPS
          if (!cancelled) setLocation(prev => ({ ...prev, loading: false, error: null }))
        }
      } catch (err) {
        if (!cancelled) {
          setLocation(prev => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load location',
          }))
        }
      }
    }

    load()

    return () => { cancelled = true }
  }, [supabase])

  return location
}
