'use server'
import { createAdminClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ── Local row types (Supabase returns untyped rows without a generated schema) ─
interface RawDocRow {
  id: string; user_id: string; status: string; shop_photo_url: string | null
  aadhar_url: string | null; shop_name?: string; owner_name?: string
  category?: string; created_at: string
  profiles?: { full_name: string; phone: string } | null
}
interface RawShopRow {
  id: string; owner_id: string; name: string; full_name?: string; phone?: string
  email?: string; category?: string; city?: string; is_approved: boolean
  is_active: boolean; shop_image_url?: string; rejection_reason?: string | null
  created_at: string; rating?: number; total_orders?: number
}
interface RawProfileRow { id: string; full_name: string; phone: string }

interface ShopListItem {
  id: string; type: 'shop' | 'document'; user_id: string; name: string
  full_name: string; phone: string; email: string; category: string
  city: string; is_approved: boolean; is_active: boolean
  image_url?: string | null; aadhar_url?: string | null
  rejection_reason?: string | null; created_at: string
  rating: number; total_orders: number
}

// ── Helper: get current authenticated user via session cookie ──────────────
async function getCurrentUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ── Bypasses RLS: checks real approval status for current shopkeeper ─────────
export async function checkShopkeeperStatus() {
  try {
    const user = await getCurrentUser()
    if (!user) return { status: 'no_user' }

    const supabase = await createAdminClient()

    // Check shop (bypasses RLS — anon client would return null due to RLS)
    const { data: shop } = await supabase
      .from('shops')
      .select('is_approved, is_active, rejection_reason')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (shop?.rejection_reason === 'BLOCKED') return { status: 'blocked' }
    if (shop?.is_approved && shop?.is_active) return { status: 'approved' }
    if (shop?.rejection_reason) return { status: 'rejected', reason: shop.rejection_reason }

    // Check documents
    const { data: docs } = await supabase
      .from('shop_documents')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!docs) return { status: 'no_documents' }
    if (docs.status === 'rejected') return { status: 'docs_rejected' }
    if (docs.status === 'pending') return { status: 'docs_pending' }
    // Docs are approved — admin has approved this shopkeeper, send to dashboard
    return { status: 'approved' }
  } catch (err: unknown) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Bypasses RLS: fetches full shop data for the current shopkeeper ────────────
export async function getShopkeeperShopData() {
  try {
    const user = await getCurrentUser()
    if (!user) return { shop: null, error: 'not_authenticated' }

    const supabase = await createAdminClient()
    const { data: shop, error } = await supabase
      .from('shops')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (error) return { shop: null, error: error.message }
    return { shop, userId: user.id }
  } catch (err: unknown) {
    return { shop: null, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Bypasses RLS: shopkeeper submits documents + creates pending shop ─────────
export async function submitShopkeeperDocuments(payload: {
  shopPhotoUrl: string
  aadharUrl: string
  shopName: string
  ownerName: string
  category: string
  latitude?: number | null
  longitude?: number | null
}) {
  try {
    const user = await getCurrentUser()
    if (!user) return { error: 'not_authenticated' }

    const supabase = await createAdminClient()

    // 1. Check not already submitted
    const { data: existing } = await supabase
      .from('shop_documents').select('id').eq('user_id', user.id).maybeSingle()
    if (existing) return { error: 'already_submitted' }

    // 2. Fetch profile for phone/email
    const { data: profile } = await supabase
      .from('profiles').select('phone, email').eq('id', user.id).maybeSingle()

    // 3. Create shop_documents record
    const { error: docErr } = await supabase.from('shop_documents').insert({
      user_id: user.id,
      shop_photo_url: payload.shopPhotoUrl,
      aadhar_url: payload.aadharUrl,
      shop_name: payload.shopName,
      owner_name: payload.ownerName,
      category: payload.category,
      status: 'pending',
    })
    if (docErr) return { error: docErr.message }

    // 4. Create shops record immediately (pending approval)
    const { data: existingShop } = await supabase
      .from('shops').select('id').eq('owner_id', user.id).maybeSingle()

    if (!existingShop) {
      const { error: shopErr } = await supabase.from('shops').insert({
        owner_id: user.id,
        name: payload.shopName,
        phone: profile?.phone || '',
        email: profile?.email || '',
        category: payload.category,
        shop_image_url: payload.shopPhotoUrl,
        is_approved: false,
        is_active: false,
        is_open: false,
        ...(payload.latitude != null && payload.longitude != null ? {
          latitude: payload.latitude,
          longitude: payload.longitude,
        } : {}),
      })
      if (shopErr) return { error: shopErr.message }
    }

    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Bypasses RLS: admin approves documents — just flips shop to active ─────────
export async function approveShopkeeperDocuments(docId: string, userId: string) {
  try {
    const supabase = await createAdminClient()

    // 1. Mark documents approved
    await supabase.from('shop_documents').update({ status: 'approved' }).eq('id', docId)

    // 2. Activate the shop (already created when docs were submitted)
    const { data: existingShop } = await supabase
      .from('shops').select('id').eq('owner_id', userId).maybeSingle()

    if (existingShop) {
      await supabase.from('shops')
        .update({ is_approved: true, is_active: true, rejection_reason: null })
        .eq('owner_id', userId)
    } else {
      // Fallback: shop wasn't pre-created, create it now
      const { data: doc } = await supabase
        .from('shop_documents')
        .select('shop_name, owner_name, category, shop_photo_url')
        .eq('id', docId).maybeSingle()
      const { data: profile } = await supabase
        .from('profiles').select('phone, email').eq('id', userId).maybeSingle()
      await supabase.from('shops').insert({
        owner_id: userId,
        name: doc?.shop_name || 'My Shop',
        phone: profile?.phone || '',
        email: profile?.email || '',
        category: doc?.category || '',
        shop_image_url: doc?.shop_photo_url || '',
        is_approved: true,
        is_active: true,
      })
    }

    // 3. Notify shopkeeper
    await supabase.from('notifications').insert({
      user_id: userId,
      title: '🎉 Documents Approved!',
      body: 'Your documents have been approved. You can now access your shopkeeper dashboard!',
      type: 'shop_approved',
    })
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Bypasses RLS: admin rejects documents ─────────────────────────────────────
export async function rejectShopkeeperDocuments(docId: string, userId: string, reason: string) {
  try {
    const supabase = await createAdminClient()
    await supabase.from('shop_documents').update({ status: 'rejected' }).eq('id', docId)
    await supabase.from('notifications').insert({
      user_id: userId,
      title: '❌ Registration Rejected',
      body: reason || 'Your registration was rejected by admin.',
      type: 'shop_rejected',
    })
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}


export async function getAdminCustomers(page = 1, pageSize = 25) {
  const supabase = await createAdminClient()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'customer')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'customer')
    .order('created_at', { ascending: false })
    .range(from, to)

  return { data, count: count || 0, error }
}

export async function getAdminAgents(tab = 'all', page = 1, pageSize = 25) {
  const supabase = await createAdminClient()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let countQuery = supabase.from('delivery_agents').select('id', { count: 'exact', head: true })
  let dataQuery = supabase.from('delivery_agents').select('*')

  if (tab === 'pending') {
    countQuery = countQuery.eq('is_approved', false).is('rejection_reason', null)
    dataQuery = dataQuery.eq('is_approved', false).is('rejection_reason', null)
  } else if (tab === 'active') {
    countQuery = countQuery.eq('is_approved', true)
    dataQuery = dataQuery.eq('is_approved', true)
  } else if (tab === 'rejected') {
    countQuery = countQuery.eq('is_approved', false).not('rejection_reason', 'is', null)
    dataQuery = dataQuery.eq('is_approved', false).not('rejection_reason', 'is', null)
  }

  const [{ count }, { data, error }] = await Promise.all([
    countQuery,
    dataQuery.order('created_at', { ascending: false }).range(from, to)
  ])

  return { data, count: count || 0, error }
}

export async function getAdminStats() {
  const supabase = await createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  
  const [shops, pendShops, agents, pendAgents, customers, orders, todayOrds, withdrawals, recOrders, complaints, totalRevData, subRevData] = await Promise.all([
    supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_approved', true),
    supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_approved', false),
    supabase.from('delivery_agents').select('id', { count: 'exact', head: true }).eq('is_approved', true),
    supabase.from('delivery_agents').select('id', { count: 'exact', head: true }).eq('is_approved', false),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id,admin_earning', { count: 'exact' }).gte('created_at', today).eq('payment_status', 'paid'),
    supabase.from('withdraw_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('orders').select('*, shops(name)').order('created_at', { ascending: false }).limit(8),
    supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    // Order-based revenue: admin_earning = platform_fee + delivery_commission - coupon_discount (already embedded)
    supabase.from('orders').select('admin_earning').eq('status', 'delivered'),
    // Subscription revenue: use amount_paid (actual money received from Razorpay)
    supabase.from('shop_subscriptions')
      .select('amount_paid')
      .eq('payment_status', 'paid')
  ])

  const todayRev = (todayOrds.data || []).reduce((s: number, o: { admin_earning: number }) => s + (o.admin_earning || 0), 0)
  const orderRev = (totalRevData.data || []).reduce((s: number, o: { admin_earning: number }) => s + (o.admin_earning || 0), 0)
  // Use amount_paid — the actual money received, not plan config price
  const subRev = (subRevData.data || []).reduce((s: number, row: { amount_paid: number | null }) => {
    return s + (Number(row.amount_paid) || 0)
  }, 0)
  const totalRev = orderRev + subRev

  return {
    stats: {
      shops: shops.count || 0,
      pendingShops: pendShops.count || 0,
      agents: agents.count || 0,
      pendingAgents: pendAgents.count || 0,
      customers: customers.count || 0,
      orders: orders.count || 0,
      todayOrders: todayOrds.count || 0,
      todayRevenue: todayRev,
      totalRevenue: totalRev,
      pendingWithdrawals: withdrawals.count || 0,
      complaints: complaints.count || 0
    },
    recentOrders: recOrders.data || []
  }
}

export async function getAdminShops(tab: 'pending' | 'active' | 'rejected' | 'all') {
  try {
    const supabase = await createAdminClient()
    
    // Get pending count for stats
    const { count: pendingCount } = await supabase
      .from('shop_documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    let fetchedItems: ShopListItem[] = []

    if (tab === 'pending') {
      // Get documents without join first
      const { data: docs, error } = await supabase
        .from('shop_documents')
        .select('id, user_id, status, shop_photo_url, aadhar_url, shop_name, owner_name, category, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      
      if (error) throw error

      // Get user IDs to fetch profiles
      const userIds = docs?.map(d => d.user_id).filter(Boolean) || []
      let profileMap: Record<string, RawProfileRow> = {}
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .in('id', userIds)
        
        profileMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {})
      }

      fetchedItems = (docs || []).map((doc: RawDocRow) => ({
        id: doc.id,
        type: 'document' as const,
        user_id: doc.user_id,
        name: doc.shop_name || 'Pending Registration',
        full_name: doc.owner_name || profileMap[doc.user_id]?.full_name || 'Unknown',
        phone: profileMap[doc.user_id]?.phone || 'Unknown',
        email: '',
        category: doc.category || 'N/A',
        city: 'N/A',
        is_approved: false,
        is_active: false,
        image_url: doc.shop_photo_url,
        aadhar_url: doc.aadhar_url,
        rejection_reason: null,
        created_at: doc.created_at,
        rating: 0,
        total_orders: 0
      }))
    } else {
      let q = supabase.from('shops').select('*').order('created_at', { ascending: false })
      if (tab === 'active') q = q.eq('is_approved', true).eq('is_active', true)
      if (tab === 'rejected') q = q.eq('is_approved', false).not('rejection_reason', 'is', null)
      
      const { data: shops } = await q
      
      // Fetch rejected docs
      let rejectedDocs: RawDocRow[] = []
      if (tab === 'rejected' || tab === 'all') {
        const { data: rDocs } = await supabase.from('shop_documents')
          .select('id, user_id, status, shop_photo_url, aadhar_url, created_at')
          .eq('status', 'rejected')
        
        // Get profiles for these docs
        const rejectedUserIds = (rDocs || []).map(d => d.user_id).filter(Boolean)
        let profileMap: Record<string, RawProfileRow> = {}
        if (rejectedUserIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone').in('id', rejectedUserIds)
          profileMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {})
        }
        
        rejectedDocs = (rDocs || []).map((doc: RawDocRow) => ({
          ...doc,
          profiles: profileMap[doc.user_id] || null
        }))
      }

      // Fetch approved docs (that haven't created a shop yet)
      let approvedDocs: RawDocRow[] = []
      if (tab === 'active' || tab === 'all') {
        const { data: aDocs } = await supabase.from('shop_documents')
          .select('id, user_id, status, shop_photo_url, aadhar_url, created_at')
          .eq('status', 'approved')
        
        const shopOwnerIds = new Set((shops || []).map((s: RawShopRow) => s.owner_id))
        
        // Get profiles for remaining docs
        const approvedUserIds = (aDocs || []).map(d => d.user_id).filter(Boolean)
        let profileMap: Record<string, RawProfileRow> = {}
        if (approvedUserIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone').in('id', approvedUserIds)
          profileMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {})
        }
        
        approvedDocs = (aDocs || []).filter((d: RawDocRow) => !shopOwnerIds.has(d.user_id)).map((doc: RawDocRow) => ({
          ...doc,
          profiles: profileMap[doc.user_id] || null
        }))
      }

      const mappedShops = (shops || []).map((shop: RawShopRow) => ({
        id: shop.id,
        type: 'shop' as const,
        user_id: shop.owner_id,
        name: shop.name,
        full_name: shop.full_name || 'Unknown',
        phone: shop.phone || 'Unknown',
        email: shop.email || '',
        category: shop.category || 'N/A',
        city: shop.city || 'N/A',
        is_approved: shop.is_approved,
        is_active: shop.is_active,
        image_url: shop.shop_image_url,
        rejection_reason: shop.rejection_reason,
        created_at: shop.created_at,
        rating: shop.rating || 0,
        total_orders: shop.total_orders || 0
      }))
      
      const mappedRejectedDocs = rejectedDocs.map((doc: RawDocRow) => {
        const profile = doc.profiles
        return {
          id: doc.id,
          type: 'document' as const,
          user_id: doc.user_id,
          name: 'Rejected Registration',
          full_name: profile?.full_name || 'Unknown',
          phone: profile?.phone || 'Unknown',
          email: '',
          category: 'N/A',
          city: 'N/A',
          is_approved: false,
          is_active: false,
          image_url: doc.shop_photo_url,
          aadhar_url: doc.aadhar_url,
          rejection_reason: 'Documents rejected',
          created_at: doc.created_at,
          rating: 0,
          total_orders: 0
        }
      })

      const mappedApprovedDocs = approvedDocs.map((doc: RawDocRow) => {
        const profile = doc.profiles
        return {
          id: doc.id,
          type: 'document' as const,
          user_id: doc.user_id,
          name: 'Approved (Pending Shop Creation)',
          full_name: profile?.full_name || 'Unknown',
          phone: profile?.phone || 'Unknown',
          email: '',
          category: 'N/A',
          city: 'N/A',
          is_approved: true,
          is_active: true,
          image_url: doc.shop_photo_url,
          aadhar_url: doc.aadhar_url,
          rejection_reason: null,
          created_at: doc.created_at,
          rating: 0,
          total_orders: 0
        }
      })

      fetchedItems = [...mappedShops, ...mappedRejectedDocs, ...mappedApprovedDocs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    return { items: fetchedItems, pendingDocs: pendingCount || 0 }
  } catch (error: unknown) {
    console.error('Error in getAdminShops:', error)
    return { 
      items: [], 
      pendingDocs: 0, 
      error: error instanceof Error ? error.message : 'Failed to fetch shops. Please ensure database migrations are applied.' 
    }
  }
}

export async function deleteShopkeeperShop(userId: string) {
  try {
    const supabase = await createAdminClient()
    
    // Find the shop
    const { data: shop } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle()

    if (shop) {
      const shopId = shop.id

      // Get all orders for this shop
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('shop_id', shopId)

      const orderIds = orders?.map(o => o.id) || []

      if (orderIds.length > 0) {
        // Nullify order references in wallet transactions
        await supabase.from('wallet_transactions').update({ order_id: null }).in('order_id', orderIds)
        // Delete reviews referencing these orders
        await supabase.from('reviews').delete().in('order_id', orderIds)
        // Delete order items
        await supabase.from('order_items').delete().in('order_id', orderIds)
        // Delete status history
        await supabase.from('order_status_history').delete().in('order_id', orderIds)
        // Delete conversations
        await supabase.from('order_conversations').delete().in('order_id', orderIds)
        // Delete payments
        await supabase.from('payments').delete().in('order_id', orderIds)
        // Delete orders
        await supabase.from('orders').delete().in('id', orderIds)
      }

      // Delete reviews
      await supabase.from('reviews').delete().eq('shop_id', shopId)
      // Delete coupons
      await supabase.from('coupons').delete().eq('shop_id', shopId)
      // Delete products
      await supabase.from('products').delete().eq('shop_id', shopId)
      // Delete shop
      await supabase.from('shops').delete().eq('id', shopId)
    }

    // Delete documents
    await supabase.from('shop_documents').delete().eq('user_id', userId)

    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function blockShopkeeperShop(userId: string) {
  try {
    const supabase = await createAdminClient()
    
    const { error } = await supabase
      .from('shops')
      .update({ is_active: false, rejection_reason: 'BLOCKED' })
      .eq('owner_id', userId)

    if (error) return { error: error.message }

    // Notify shopkeeper
    await supabase.from('notifications').insert({
      user_id: userId,
      title: '🚫 Shop Blocked',
      body: 'Your shop has been blocked by the admin. Please contact support.',
      type: 'shop_rejected'
    })

    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function unblockShopkeeperShop(userId: string) {
  try {
    const supabase = await createAdminClient()
    
    const { error } = await supabase
      .from('shops')
      .update({ is_active: true, rejection_reason: null })
      .eq('owner_id', userId)

    if (error) return { error: error.message }

    // Notify shopkeeper
    await supabase.from('notifications').insert({
      user_id: userId,
      title: '🎉 Shop Unblocked',
      body: 'Your shop has been unblocked by the admin. You can resume your business now!',
      type: 'shop_approved'
    })

    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
