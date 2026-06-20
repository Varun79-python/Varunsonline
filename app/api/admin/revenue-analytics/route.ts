import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/modules/infrastructure/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Admin-only analytics — heavy aggregation queries.
// Keep dynamic to always show latest data.

async function verifyAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const token = session.access_token
  const authHeader = `Bearer ${token}`
  return { user: session.user, authHeader }
}

export async function GET(req: NextRequest) {
  try {
    // Verify admin via Authorization header OR session cookie
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null
    let userEmail: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const supabase = await createAdminClient()
      const { data: { user } } = await supabase.auth.getUser(authHeader.substring(7))
      userId = user?.id ?? null
      userEmail = user?.email ?? null
    } else {
      const session = await verifyAdmin()
      userId = session?.user?.id ?? null
      userEmail = session?.user?.email ?? null
    }

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL
    const db = await createAdminClient()

    // Verify the user has admin role (check both profile.role and email fallback)
    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    const isAdminRole = profile?.role === 'admin'
    const isAdminEmail = ADMIN_EMAIL && userEmail === ADMIN_EMAIL

    if (!isAdminRole && !isAdminEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Run all analytics queries in parallel ──────────────────────────────
    const [
      deliveredOrders,
      allOrders,
      cancelledOrders,
      payments,
      subscriptions,
      withdrawals,
      shopWallets,
      agentWallets,
      agentSettlements,
    ] = await Promise.all([
      // All delivered orders with full financials
      db.from('orders')
        .select('id, total_amount, subtotal, delivery_charge, platform_fee, discount_amount, agent_earning, shopkeeper_earning, admin_earning, payment_method, created_at, shop_id')
        .eq('status', 'delivered'),

      // All orders for counts/AOV
      db.from('orders')
        .select('id, total_amount, status, payment_status, payment_method, created_at'),

      // Cancelled/rejected orders
      db.from('orders')
        .select('id, total_amount, discount_amount, platform_fee')
        .in('status', ['cancelled', 'rejected']),

      // Payment records (online payments via Razorpay)
      db.from('payments')
        .select('id, amount, status, method, created_at'),

      // Shopkeeper subscription payments — use amount_paid (actual money received)
      db.from('shop_subscriptions')
        .select('id, shop_id, plan_id, payment_status, amount_paid, start_date, end_date, created_at, subscription_plans(name, monthly_fee, fee_percent, plan_type)'),

      // Withdrawal requests
      db.from('withdraw_requests')
        .select('id, user_id, user_type, amount, status, requested_at, processed_at'),

      // Shop wallet totals
      db.from('shops')
        .select('id, name, wallet_balance, total_earnings, total_orders')
        .eq('is_approved', true),

      // Agent wallet totals
      db.from('delivery_agents')
        .select('id, wallet_balance, total_earnings, total_deliveries'),

      // Agent COD settlements (wallet_transactions with positive amount = settlement)
      db.from('wallet_transactions')
        .select('id, user_id, user_type, type, amount, description, created_at')
        .eq('user_type', 'delivery_agent'),
    ])

    const dOrders = deliveredOrders.data || []
    const aOrders = allOrders.data || []
    const cOrders = cancelledOrders.data || []
    const pRecords = payments.data || []
    const subs = subscriptions.data || []
    const wdRequests = withdrawals.data || []
    const shops = shopWallets.data || []
    const agents = agentWallets.data || []
    const agentTxns = agentSettlements.data || []

    // ── ORDER-BASED ANALYTICS ─────────────────────────────────────────────
    let totalCustomerPaid = 0, totalProductAmount = 0, totalDeliveryFee = 0
    let totalPlatformFee = 0, totalCouponDiscount = 0, totalAgentEarnings = 0
    let totalShopkeeperEarnings = 0, totalAdminOrderEarning = 0
    let totalCodAmount = 0, totalOnlineAmount = 0
    let highestOrder = 0, lowestOrder = Infinity

    // Daily revenue map for trend
    const dailyRevMap: Record<string, number> = {}

    for (const o of dOrders) {
      totalCustomerPaid += o.total_amount || 0
      totalProductAmount += o.subtotal || 0
      totalDeliveryFee += o.delivery_charge || 0
      totalPlatformFee += o.platform_fee || 0
      totalCouponDiscount += o.discount_amount || 0
      totalAgentEarnings += o.agent_earning || 0
      totalShopkeeperEarnings += o.shopkeeper_earning || 0
      totalAdminOrderEarning += o.admin_earning || 0
      if (o.payment_method === 'cod') totalCodAmount += o.total_amount || 0
      else totalOnlineAmount += o.total_amount || 0
      if ((o.total_amount || 0) > highestOrder) highestOrder = o.total_amount || 0
      if ((o.total_amount || 0) < lowestOrder) lowestOrder = o.total_amount || 0

      const day = (o.created_at || '').slice(0, 10)
      if (day) dailyRevMap[day] = (dailyRevMap[day] || 0) + (o.admin_earning || 0)
    }

    const deliveredCount = dOrders.length
    const avgOrderValue = deliveredCount > 0 ? totalCustomerPaid / deliveredCount : 0
    if (lowestOrder === Infinity) lowestOrder = 0

    // Daily trend — last 30 days
    const today = new Date()
    const dailyTrend: { date: string; revenue: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      dailyTrend.push({ date: key, revenue: dailyRevMap[key] || 0 })
    }

    const highestRevenueDay = dailyTrend.reduce((best, d) => d.revenue > best.revenue ? d : best, { date: '', revenue: 0 })
    const lowestRevenueDayWithOrders = dailyTrend.filter(d => d.revenue > 0).reduce((worst, d) => d.revenue < worst.revenue ? d : worst, { date: '', revenue: Infinity })

    // ── ORDER STATUS BREAKDOWN ────────────────────────────────────────────
    const totalOrders = aOrders.length
    const statusCounts: Record<string, number> = {}
    let failedPayments = 0, refundedPayments = 0
    for (const o of aOrders) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1
    }
    for (const p of pRecords) {
      if (p.status === 'failed') failedPayments++
      if (p.status === 'refunded') refundedPayments++
    }

    const cancelledLoss = cOrders.reduce((s, o) => s + (o.platform_fee || 0), 0)
    const onlinePct = totalOrders > 0 ? Math.round((aOrders.filter(o => o.payment_method !== 'cod').length / totalOrders) * 100) : 0
    const codPct = 100 - onlinePct

    // ── SUBSCRIPTION ANALYTICS ────────────────────────────────────────────
    // Use amount_paid (actual money received from Razorpay) NOT plan config price
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paidSubs = (subs as any[]).filter(s => s.payment_status === 'paid')
    const totalSubRevenue = paidSubs.reduce((s, sub) => {
      return s + (Number(sub.amount_paid) || 0)
    }, 0)
    // Active subscription = end_date is in the future AND is_active = true
    const now = new Date()
    const activeSubCount = paidSubs.filter(s => {
      if (s.end_date) {
        return new Date(s.end_date) > now
      }
      // Fallback: if no end_date, use start_date + 30 days
      if (s.start_date) {
        const start = new Date(s.start_date)
        const thirtyDaysLater = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000)
        return thirtyDaysLater > now
      }
      return false
    }).length
    const expiredSubCount = paidSubs.length - activeSubCount

    // ── ADMIN TOTAL REVENUE (ORDER + SUBSCRIPTIONS) ───────────────────────
    // STRICT: admin earns only platform_fee + subscriptions
    // Use totalPlatformFee (column) not admin_earning (which has old formula for historical orders)
    const totalAdminOrderRevenue = totalPlatformFee  // platform_fee is always correct
    const totalAdminRevenue = totalAdminOrderRevenue + totalSubRevenue
    // delivery_commission = delivery_fee - agent_earning → 0 with new formula (agent gets 100%)
    const totalDeliveryCommission = Math.max(0, totalDeliveryFee - totalAgentEarnings)

    // ── WITHDRAWAL ANALYTICS ──────────────────────────────────────────────
    const shopWithdrawals = wdRequests.filter(w => w.user_type === 'shopkeeper')
    const agentWithdrawalReqs = wdRequests.filter(w => w.user_type === 'delivery_agent')
    const shopWithdrawalPaid = shopWithdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + Number(w.amount), 0)
    const shopWithdrawalPending = shopWithdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + Number(w.amount), 0)
    const agentWithdrawalPaid = agentWithdrawalReqs.filter(w => w.status === 'paid').reduce((s, w) => s + Number(w.amount), 0)
    const agentWithdrawalPending = agentWithdrawalReqs.filter(w => w.status === 'pending').reduce((s, w) => s + Number(w.amount), 0)

    // ── SHOP FINANCIAL SUMMARY ────────────────────────────────────────────
    const totalShopWalletBalance = shops.reduce((s, sh) => s + (Number(sh.wallet_balance) || 0), 0)
    const totalShopLifetimeEarnings = shops.reduce((s, sh) => s + (Number(sh.total_earnings) || 0), 0)
    const topShops = [...shops]
      .sort((a, b) => (Number(b.total_earnings) || 0) - (Number(a.total_earnings) || 0))
      .slice(0, 5)
      .map(sh => ({ name: sh.name, earnings: Number(sh.total_earnings) || 0, orders: sh.total_orders || 0 }))

    // ── AGENT FINANCIAL SUMMARY ───────────────────────────────────────────
    const totalAgentWalletBalance = agents.reduce((s, a) => s + (Number(a.wallet_balance) || 0), 0)
    const totalAgentLifetimeEarnings = agents.reduce((s, a) => s + (Number(a.total_earnings) || 0), 0)
    const negativeBalanceAgents = agents.filter(a => (Number(a.wallet_balance) || 0) < 0).length
    const codCashOwed = agents.filter(a => (Number(a.wallet_balance) || 0) < 0)
      .reduce((s, a) => s + Math.abs(Number(a.wallet_balance) || 0), 0)

    // Agent settlements = credit transactions from agents paying back COD
    const agentCodSettlements = agentTxns.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0)
    const pendingCodSettlement = codCashOwed

    // ── GROSS FLOW vs NET PROFIT ──────────────────────────────────────────
    // Inflow = money received by platform
    const grossInflow = totalCustomerPaid + totalSubRevenue
    // Outflow = money paid out by platform (coupon discount is NOT an outflow — it's revenue foregone)
    const grossOutflow = totalShopkeeperEarnings + totalAgentEarnings
    // Net = what platform keeps
    const netRevenue = grossInflow - grossOutflow
    // Losses = platform costs (coupons absorbed, cancelled platform fees)
    const totalLosses = totalCouponDiscount + cancelledLoss

    return NextResponse.json({
      // Order analytics
      orders: {
        delivered: deliveredCount,
        total: totalOrders,
        cancelled: statusCounts.cancelled || 0,
        rejected: statusCounts.rejected || 0,
        statusCounts,
        avgOrderValue: Math.round(avgOrderValue),
        highestOrderValue: highestOrder,
        lowestOrderValue: lowestOrder,
        failedPayments,
        refundedPayments,
        cancelledLoss: Math.round(cancelledLoss),
      },
      // Customer payment analytics
      customer: {
        totalCustomerPaid: Math.round(totalCustomerPaid),
        totalProductAmount: Math.round(totalProductAmount),
        totalDeliveryFee: Math.round(totalDeliveryFee),
        totalPlatformFee: Math.round(totalPlatformFee),
        totalCouponDiscount: Math.round(totalCouponDiscount),
        totalCodAmount: Math.round(totalCodAmount),
        totalOnlineAmount: Math.round(totalOnlineAmount),
        onlinePct,
        codPct,
      },
      // Agent analytics
      agent: {
        totalDeliveryEarnings: Math.round(totalAgentEarnings),
        totalCodCashCollected: Math.round(totalCodAmount), // agents collect full order in COD
        pendingCodSettlement: Math.round(pendingCodSettlement),
        completedSettlements: Math.round(agentCodSettlements),
        negativeBalanceAgents,
        totalWalletBalance: Math.round(totalAgentWalletBalance),
        totalLifetimeEarnings: Math.round(totalAgentLifetimeEarnings),
        withdrawalsPaid: Math.round(agentWithdrawalPaid),
        withdrawalsPending: Math.round(agentWithdrawalPending),
      },
      // Shopkeeper analytics
      shopkeeper: {
        totalProductEarnings: Math.round(totalShopkeeperEarnings),
        totalWalletBalance: Math.round(totalShopWalletBalance),
        totalLifetimeEarnings: Math.round(totalShopLifetimeEarnings),
        withdrawalsPaid: Math.round(shopWithdrawalPaid),
        withdrawalsPending: Math.round(shopWithdrawalPending),
        topShops,
        subscriptionRevenue: Math.round(totalSubRevenue),
        paidSubscriptions: paidSubs.length,
        activeSubscriptions: activeSubCount,
        expiredSubscriptions: expiredSubCount,
      },
      // Admin earnings (STRICT: platform_fee + subscriptions only)
      admin: {
        totalRevenue: Math.round(totalAdminRevenue),
        orderEarnings: Math.round(totalAdminOrderRevenue),
        platformFeeEarnings: Math.round(totalPlatformFee),
        deliveryCommissionEarnings: Math.round(totalDeliveryCommission),
        subscriptionEarnings: Math.round(totalSubRevenue),
        couponCost: Math.round(totalCouponDiscount),
        cancelledLoss: Math.round(cancelledLoss),
        refundLoss: refundedPayments,
        // P&L summary
        grossInflow: Math.round(grossInflow),
        grossOutflow: Math.round(grossOutflow),
        netRevenue: Math.round(netRevenue),
        netProfit: Math.round(netRevenue),  // same as netRevenue
        totalLosses: Math.round(totalLosses),
      },
      // Trend data
      trend: {
        daily: dailyTrend,
        highestRevenueDay,
        lowestRevenueDay: lowestRevenueDayWithOrders.revenue === Infinity
          ? { date: '', revenue: 0 }
          : lowestRevenueDayWithOrders,
      },
      // Plan-wise subscription revenue breakdown
      subscriptionPlans: (() => {
        const planMap: Record<string, { name: string; count: number; revenue: number }> = {}
        for (const sub of paidSubs as any[]) {
          const planName = (sub as any).subscription_plans?.name || 'Unknown'
          if (!planMap[planName]) planMap[planName] = { name: planName, count: 0, revenue: 0 }
          planMap[planName].count++
          planMap[planName].revenue += Number(sub.amount_paid) || 0
        }
        return Object.values(planMap).sort((a, b) => b.revenue - a.revenue)
      })(),
      // COD settlement summary
      codSettlements: {
        totalOwedToPlatform: Math.round(totalCodAmount - totalAgentEarnings),
        pendingFromAgents: Math.round(pendingCodSettlement),
        collectedByAgents: Math.round(agentCodSettlements),
        agentsWithNegativeBalance: negativeBalanceAgents,
      },
    })
  } catch (err) {
    console.error('Revenue analytics error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
