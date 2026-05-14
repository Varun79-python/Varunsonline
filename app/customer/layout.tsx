import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import CustomerShell from '@/components/customer/CustomerShell'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const metaRole = user.user_metadata?.role || user.app_metadata?.role

  if (metaRole === 'customer') {
    return <CustomerShell>{children}</CustomerShell>
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role === 'customer') {
    return <CustomerShell>{children}</CustomerShell>
  }

  redirect('/login')
}