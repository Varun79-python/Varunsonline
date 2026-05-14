import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import CustomerShell from '@/components/customer/CustomerShell'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
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

  if (!user) {
    return <>{children}</>
  }

  return <CustomerShell>{children}</CustomerShell>
}