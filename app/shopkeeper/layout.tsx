import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import ShopkeeperShell from '@/components/shopkeeper/ShopkeeperShell'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export default async function ShopkeeperLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login/shopkeeper')
  }

  // Verify shopkeeper role
  const metaRole = user.user_metadata?.role || user.app_metadata?.role

  if (metaRole === 'shopkeeper') {
    return <ShopkeeperShell>{children}</ShopkeeperShell>
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role === 'shopkeeper') {
    return <ShopkeeperShell>{children}</ShopkeeperShell>
  }

  redirect('/login')
}