/**
 * lib/fcm.ts
 *
 * Server-side FCM HTTP v1 API sender using firebase-admin SDK.
 * Used by API routes only — never imported by client components.
 *
 * Setup: set FIREBASE_SERVICE_ACCOUNT_JSON env var to the full JSON
 * string of your Firebase service account key file.
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0]
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env variable is not set')
  }
  const serviceAccount = JSON.parse(serviceAccountJson)
  return initializeApp({ credential: cert(serviceAccount) })
}

export interface FcmPayload {
  token: string
  title: string
  body: string
  data?: Record<string, string>
  /** Android notification channel — must match channels configured in the app */
  channelId?: string
}

/**
 * Send a single FCM notification via the HTTP v1 API.
 * Returns { success: true } or { success: false, error: string }.
 */
export async function sendFcmNotification(payload: FcmPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const app = getFirebaseApp()
    const messaging = getMessaging(app)

    await messaging.send({
      token: payload.token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: payload.channelId || 'varunsonline_orders',
          sound: 'default',
          vibrateTimingsMillis: [0, 250, 250, 250],
          priority: 'max',
          defaultVibrateTimings: false,
          notificationCount: 1,
        },
      },
      // apns (iOS) config would go here if needed
      data: payload.data || {},
    })

    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // Log but don't crash — push failure should never break the order flow
    console.error('[FCM] Send error:', message)
    return { success: false, error: message }
  }
}

/**
 * Send to multiple tokens (fan-out).
 * Silently skips invalid/empty tokens.
 */
export async function sendFcmToMany(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
  channelId?: string
): Promise<void> {
  const valid = tokens.filter(t => t && t.length > 10)
  if (valid.length === 0) return

  await Promise.allSettled(
    valid.map(token =>
      sendFcmNotification({ token, title, body, data, channelId })
    )
  )
}
