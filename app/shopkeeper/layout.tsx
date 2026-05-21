import { cookies, headers } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import ShopkeeperShell from '@/components/shopkeeper/ShopkeeperShell'

export default async function ShopkeeperLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Allow unauthenticated users to view pages without the dashboard shell
  if (!user) {
    return <>{children}</>
  }

  // Check if the shopkeeper's shop is approved and active
  // Only show the dashboard shell for fully approved & active shops
  const { data: shop } = await supabase
    .from('shops')
    .select('is_approved, is_active')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!shop || !shop.is_approved || !shop.is_active) {
    // Shop not approved/active yet — render without shell (status page will handle it)
    return <>{children}</>
  }

  return <ShopkeeperShell>{children}</ShopkeeperShell>
}