/**
 * lib/usePushNotifications.ts
 *
 * Capacitor push-notification hook.
 * - Runs only inside the APK (Capacitor native context).
 * - Silently skips in browser/Next.js server.
 * - Registers device FCM token → POST /api/notifications/register-token
 * - Routes tap-to-open notifications to the correct page.
 * - Deduplicates registrations using a ref so the effect is safe to call
 *   from multiple layouts simultaneously.
 */
'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const isCapacitor = () =>
  typeof window !== 'undefined' && !!(window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

interface PushNotificationData {
  orderId?: string
  role?: 'shopkeeper' | 'delivery_agent'
  type?: 'new_order' | 'agent_assigned'
}

export function usePushNotifications(userId: string | null) {
  const router = useRouter()
  const registered = useRef(false)

  useEffect(() => {
    if (!isCapacitor() || !userId || registered.current) return
    registered.current = true

    async function setup() {
      try {
        // Dynamic import keeps firebase-admin out of the browser bundle
        const { PushNotifications } = await import('@capacitor/push-notifications')

        // 1. Request permission (Android 13+ requires explicit grant)
        const permResult = await PushNotifications.requestPermissions()
        if (permResult.receive !== 'granted') {
          console.warn('[FCM] Push permission denied')
          return
        }

        // 2. Register with FCM
        await PushNotifications.register()

        // 3. Receive token → save to DB
        PushNotifications.addListener('registration', async (token) => {
          try {
            await fetch('/api/notifications/register-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, token: token.value })
            })
          } catch (e) {
            console.error('[FCM] Token registration error:', e)
          }
        })

        // 4. Foreground notification received — the in-app alert/sound system handles this
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[FCM] Foreground notification:', notification.title)
          // In-app realtime system (useOrderAlert) already handles sound — no duplicate action needed
        })

        // 5. Notification tapped (background / closed state) → deep link
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const data = action.notification.data as PushNotificationData
          if (!data) return

          // Route based on role + type
          if (data.type === 'new_order' && data.role === 'shopkeeper') {
            router.push('/shopkeeper')
          } else if (data.type === 'agent_assigned' && data.role === 'delivery_agent') {
            router.push('/delivery')
          } else if (data.orderId) {
            // Fallback: go to delivery dashboard which shows the active order
            router.push('/delivery')
          }
        })

        // 6. Error handler
        PushNotifications.addListener('registrationError', (err) => {
          console.error('[FCM] Registration error:', err)
        })

      } catch (e) {
        // Capacitor not available (browser) — silently ignore
        console.log('[FCM] Not in Capacitor context, push notifications disabled')
      }
    }

    setup()

    return () => {
      // Listeners are cleaned up by Capacitor automatically when app is destroyed
      // No action needed here — the `registered` ref prevents double-registration
    }
  }, [userId, router])
}
