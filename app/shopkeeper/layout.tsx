import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ShopkeeperShell from '@/components/shopkeeper/ShopkeeperShell'

export default async function ShopkeeperLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()

  // Anon client — only for auth session (not for RLS-restricted table reads)
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { user } } = await anonClient.auth.getUser()

  if (!user) {
    redirect('/login/shopkeeper')
  }

  // ✅ Use service-role admin client to bypass RLS on shops table
  const adminClient = await createAdminClient()

  const { data: shop } = await adminClient
    .from('shops')
    .select('is_approved, is_active')
    .eq('owner_id', user.id)
    .maybeSingle()

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