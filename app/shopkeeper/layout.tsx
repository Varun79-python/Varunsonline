import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import ShopkeeperShell from '@/components/shopkeeper/ShopkeeperShell'

export default async function ShopkeeperLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()

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

  // If no user is found, they might be on /shopkeeper/register which is allowed by middleware.
  // We render it without the dashboard shell.
  if (!user) {
    return <>{children}</>
  }

  // Middleware handles role enforcement and redirection for authenticated users.
  // We just render the shell.
  return <ShopkeeperShell>{children}</ShopkeeperShell>
}