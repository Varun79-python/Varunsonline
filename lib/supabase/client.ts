import { createBrowserClient } from '@supabase/ssr'

let _client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase environment variables not configured. This is expected during build.')
    return null as any
  }

  // Reuse single browser instance — prevents multiple GoTrue auth listeners
  // and stops false SIGNED_OUT events on tab switch
  if (_client) return _client

  _client = createBrowserClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      autoRefreshToken: true,
      storageKey: 'varunsonline-auth',
    }
  })

  return _client
}
