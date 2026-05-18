'use server'
import { createAdminClient } from '@/lib/supabase/server'

export async function getAdminCustomers() {
  const supabase = await createAdminClient()
  return await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'customer')
    .order('created_at', { ascending: false })
}

export async function getAdminAgents() {
  const supabase = await createAdminClient()
  return await supabase
    .from('delivery_agents')
    .select('*')
    .order('created_at', { ascending: false })
}

export async function getAdminStats() {
  const supabase = await createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  
  const [shops, pendShops, agents, pendAgents, customers, orders, todayOrds, withdrawals, recOrders, complaints] = await Promise.all([
    supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_approved', true),
    supabase.from('shops').select('id', { count: 'exact', head: true }).eq('is_approved', false),
    supabase.from('delivery_agents').select('id', { count: 'exact', head: true }).eq('is_approved', true),
    supabase.from('delivery_agents').select('id', { count: 'exact', head: true }).eq('is_approved', false),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id,admin_earning', { count: 'exact' }).gte('created_at', today).eq('payment_status', 'paid'),
    supabase.from('withdraw_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('orders').select('*, shops(name)').order('created_at', { ascending: false }).limit(8),
    supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'open')
  ])

  const todayRev = (todayOrds.data || []).reduce((s: number, o: { admin_earning: number }) => s + (o.admin_earning || 0), 0)
  
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
      totalRevenue: 0,
      pendingWithdrawals: withdrawals.count || 0,
      complaints: complaints.count || 0
    },
    recentOrders: recOrders.data || []
  }
}

export async function getAdminShops(tab: 'pending' | 'active' | 'rejected' | 'all') {
  const supabase = await createAdminClient()
  
  // Get pending count for stats
  const { count: pendingCount } = await supabase
    .from('shop_documents')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  let fetchedItems: any[] = []

  if (tab === 'pending') {
    const { data: docs, error } = await supabase
      .from('shop_documents')
      .select('id, user_id, status, shop_photo_url, aadhar_url, created_at, profiles(full_name, phone)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    
    if (error) throw error

    fetchedItems = (docs || []).map((doc: any) => ({
      id: doc.id,
      type: 'document',
      user_id: doc.user_id,
      name: 'Pending Registration',
      full_name: doc.profiles?.full_name || 'Unknown',
      phone: doc.profiles?.phone || 'Unknown',
      email: '',
      category: 'N/A',
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
    let rejectedDocs: any[] = []
    if (tab === 'rejected' || tab === 'all') {
      const { data: rDocs } = await supabase.from('shop_documents')
        .select('id, user_id, status, shop_photo_url, aadhar_url, created_at, profiles(full_name, phone)')
        .eq('status', 'rejected')
      rejectedDocs = rDocs || []
    }

    // Fetch approved docs (that haven't created a shop yet)
    let approvedDocs: any[] = []
    if (tab === 'active' || tab === 'all') {
      const { data: aDocs } = await supabase.from('shop_documents')
        .select('id, user_id, status, shop_photo_url, aadhar_url, created_at, profiles(full_name, phone)')
        .eq('status', 'approved')
      
      const shopOwnerIds = new Set((shops || []).map((s: any) => s.owner_id))
      approvedDocs = (aDocs || []).filter((d: any) => !shopOwnerIds.has(d.user_id))
    }

    const mappedShops = (shops || []).map((shop: any) => ({
      id: shop.id,
      type: 'shop',
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
    
    const mappedRejectedDocs = rejectedDocs.map((doc: any) => ({
      id: doc.id,
      type: 'document',
      user_id: doc.user_id,
      name: 'Rejected Registration',
      full_name: doc.profiles?.full_name || 'Unknown',
      phone: doc.profiles?.phone || 'Unknown',
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
    }))

    const mappedApprovedDocs = approvedDocs.map((doc: any) => ({
      id: doc.id,
      type: 'document',
      user_id: doc.user_id,
      name: 'Approved (Pending Shop Creation)',
      full_name: doc.profiles?.full_name || 'Unknown',
      phone: doc.profiles?.phone || 'Unknown',
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
    }))

    fetchedItems = [...mappedShops, ...mappedRejectedDocs, ...mappedApprovedDocs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  return { items: fetchedItems, pendingDocs: pendingCount || 0 }
}
