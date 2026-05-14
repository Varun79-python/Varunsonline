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

  // Allow unauthenticated/registering users to view the registration page without the dashboard shell or redirects
  if (!user || pathname === '/shopkeeper/register') {
    return <>{children}</>
  }

  // ── Enforce Onboarding Flow for Dashboard Pages ──

  // 1. Check if shop exists
  const { data: shop } = await supabase
    .from('shops')
    .select('id, is_approved, is_active')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!shop) {
    redirect('/shopkeeper/register')
  }

  // 2. Check if documents are uploaded
  const { data: docs } = await supabase
    .from('shop_documents')
    .select('id')
    .eq('shop_id', shop.id)
    .maybeSingle()

  if (!docs) {
    redirect('/login/shopkeeper/register/documents')
  }

  // 3. Check if approved and active
  if (!shop.is_approved || !shop.is_active) {
    redirect('/login/status')
  }

  // If all checks pass, render the dashboard shell
  return <ShopkeeperShell>{children}</ShopkeeperShell>
}