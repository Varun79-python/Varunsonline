import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
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

  // Role check — ensure only customers can access the customer shell
  const metaRole = user.user_metadata?.role || user.app_metadata?.role
  if (metaRole && metaRole !== 'customer') {
    redirect('/login')
  }
  if (!metaRole) {
    // Fallback: check profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile && profile.role !== 'customer') {
      redirect('/login')
    }
  }

  return <CustomerShell>{children}</CustomerShell>
}