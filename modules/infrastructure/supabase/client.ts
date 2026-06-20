import { createBrowserClient } from '@supabase/ssr'

let _client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are not configured.')
  }

  // Reuse single browser instance — prevents multiple GoTrue auth listeners
  // storageKey is intentionally NOT set so cookies use the default Supabase
  // naming (sb-{ref}-auth-token) which the server-side middleware can read.
  if (_client) return _client

  _client = createBrowserClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      autoRefreshToken: true,
    }
  })

  return _client
}

