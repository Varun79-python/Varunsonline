import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/modules/infrastructure/supabase/server'
import { redirect } from 'next/navigation'
import ShopkeeperShell from '@/modules/shopkeeper/components/ShopkeeperShell'

export default async function ShopkeeperLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()

  // Anon client — only for auth session (not for RLS-restricted table reads)
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  // Use getSession() instead of getUser() to avoid unnecessary network call.
  // The middleware already verified the JWT, so the cookie-based session is trusted.
  const { data: { session } } = await anonClient.auth.getSession()
  const user = session?.user ?? null

  if (!user) {
    redirect('/login/shopkeeper')
  }

  // ✅ Use service-role admin client to bypass RLS on shops table
  const adminClient = await createAdminClient()

  const { data: shop } = await adminClient
    .from('shops')
    .select('is_approved, is_active, rejection_reason')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (shop?.rejection_reason === 'BLOCKED') {
    redirect('/login/status')
  }

  if (shop?.is_approved && shop?.is_active) {
    return <ShopkeeperShell>{children}</ShopkeeperShell>
  }

  // Not approved — check docs to route to the right step
  const { data: docs } = await adminClient
    .from('shop_documents')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!docs) {
    redirect('/login/shopkeeper/register/documents')
  }

  redirect('/login/status')
}