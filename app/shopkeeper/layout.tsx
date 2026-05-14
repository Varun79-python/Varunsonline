import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
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

  return <ShopkeeperShell>{children}</ShopkeeperShell>
}