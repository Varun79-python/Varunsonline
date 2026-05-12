'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Plan {
  id: string; name: string; description: string
  plan_type: 'percentage' | 'fixed_monthly'
  fee_percent: number; monthly_fee: number; duration_days: number
}

interface ShopSub {
  id: string; plan_id: string; is_active: boolean
  starts_at: string; expires_at: string; payment_status: string
  subscription_plans: { name: string; plan_type: string; monthly_fee: number; fee_percent: number }
}

declare global {
  interface Window { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } }
}

export default function ShopkeeperPlans() {
  const supabase = createClient()
  const router = useRouter()
  const [allPlans, setAllPlans] = useState<Plan[]>([])
  const [shopId, setShopId] = useState<string | null>(null)
  const [activeSub, setActiveSub] = useState<ShopSub | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  // Shopkeeper chooses which type they want first
  const [selectedType, setSelectedType] = useState<'all' | 'percentage' | 'fixed_monthly'>('all')

  const [nowTime, setNowTime] = useState<number>(0)
  useEffect(() => { setNowTime(Date.now()) }, [])

  async function getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: shop } = await supabase
        .from('shops')
        .select('id, subscription_plan_id, subscription_expires_at')
        .eq('owner_id', user.id).single()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)

      // Load active subscription
      const { data: sub } = await supabase
        .from('shop_subscriptions')
        .select('*, subscription_plans(name, plan_type, monthly_fee, fee_percent)')
        .eq('shop_id', shop.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      setActiveSub(sub)

      // Load available plans (only active ones, via public API)
      const { data: p } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('monthly_fee')
      setAllPlans(p || [])
      setLoading(false)
    }
    load()
  }, [])

  const percentagePlans = allPlans.filter(p => p.plan_type === 'percentage')
  const monthlyPlans = allPlans.filter(p => p.plan_type === 'fixed_monthly')
  const filteredPlans = selectedType === 'all' ? allPlans : allPlans.filter(p => p.plan_type === selectedType)

  // Activate without payment (percentage plans OR free monthly plans)
  async function activateDirectly(plan: Plan) {
    setPurchasing(plan.id)
    const now = new Date()
    const expiresAt = plan.plan_type === 'fixed_monthly' && plan.duration_days > 0
      ? new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString()
      : null
    await supabase.from('shop_subscriptions').update({ is_active: false }).eq('shop_id', shopId!).eq('is_active', true)
    await supabase.from('shop_subscriptions').insert({
      shop_id: shopId, plan_id: plan.id, payment_status: 'paid',
      starts_at: now.toISOString(), expires_at: expiresAt, is_active: true
    })
    await supabase.from('shops').update({
      is_active: true, subscription_plan_id: plan.id,
      subscription_fee_percent: plan.plan_type === 'percentage' ? plan.fee_percent : 0,
      subscription_expires_at: expiresAt
    }).eq('id', shopId)
    const successMsg = plan.plan_type === 'percentage'
      ? `✅ Activated! ${plan.fee_percent}% auto-deducted from each order. Shop is now live!`
      : `✅ Plan activated! Shop is now live${plan.duration_days > 0 ? ` for ${plan.duration_days} days` : ''}.`
    setMsg({ text: successMsg, ok: true })
    setPurchasing(null)
    setTimeout(() => router.push('/shopkeeper'), 2500)
  }

  async function buyPlan(plan: Plan) {
    if (!shopId || purchasing) return

    // Percentage plan — always free, deduction happens per order automatically
    if (plan.plan_type === 'percentage') {
      await activateDirectly(plan)
      return
    }

    // Fixed monthly with ₹0 — free activation, no Razorpay
    if (plan.monthly_fee <= 0) {
      await activateDirectly(plan)
      return
    }

    // Fixed monthly with real amount (> ₹0) — open Razorpay
    setPurchasing(plan.id)
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch('/api/shopkeeper/create-subscription-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ planId: plan.id, shopId, amount: plan.monthly_fee })
      })
      const { orderId, key, error } = await res.json()
      if (error) { setMsg({ text: `❌ ${error}`, ok: false }); setPurchasing(null); return }

      const rz = new window.Razorpay({
        key, amount: Math.round(plan.monthly_fee * 100), currency: 'INR',
        name: "Varun's Online", description: `${plan.name} — ${plan.duration_days} days`,
        order_id: orderId,
        handler: async (response: Record<string, string>) => {
          const authHeader = await getAuthHeader()
          const verifyRes = await fetch('/api/shopkeeper/verify-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId: plan.id, shopId, durationDays: plan.duration_days
            })
          })
          const vd = await verifyRes.json()
          if (vd.success) {
            setMsg({ text: `✅ Payment of ₹${plan.monthly_fee} successful! Shop is now live for ${plan.duration_days} days.`, ok: true })
            setTimeout(() => router.push('/shopkeeper'), 2500)
          } else {
            setMsg({ text: `❌ Payment verification failed: ${vd.error}`, ok: false })
          }
          setPurchasing(null)
        },
        prefill: {}, theme: { color: '#f97316' }
      })
      rz.open()
    } catch {
      setMsg({ text: '❌ Payment failed. Try again.', ok: false })
      setPurchasing(null)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  const expiresAt = activeSub?.expires_at ? new Date(activeSub.expires_at) : null
  const daysLeft = expiresAt && nowTime > 0 ? Math.ceil((expiresAt.getTime() - nowTime) / 86400000) : null
  const isPercentagePlan = activeSub?.subscription_plans?.plan_type === 'percentage'

  return (
    <div style={{ padding: '0 12px', maxWidth: 640, margin: '0 auto' }}>
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <h2 style={{ marginBottom: 6, fontSize: '1.2rem' }}>📋 Subscription Plan</h2>
      <p style={{ color: '#64748b', marginBottom: 20, fontSize: '0.85rem' }}>
        Your shop needs an active plan to be visible to customers.
      </p>

      {msg && (
        <div style={{ background: msg.ok ? '#dcfce7' : '#fee2e2', border: `1px solid ${msg.ok ? '#86efac' : '#fca5a5'}`, borderRadius: 10, padding: '14px 16px', marginBottom: 20, color: msg.ok ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: '0.85rem' }}>
          {msg.text}
        </div>
      )}

      {/* Active Subscription Banner */}
      {activeSub && (
        <div style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', borderRadius: 14, padding: '18px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: '1.2rem' }}>✓</span>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'white' }}>
              Active: {activeSub.subscription_plans?.name}
            </span>
          </div>
          {isPercentagePlan ? (
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', margin: 0 }}>
              {activeSub.subscription_plans.fee_percent}% commission per order
            </p>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', margin: 0 }}>
              {expiresAt ? `Valid until: ${expiresAt.toLocaleDateString('en-IN')}` : ''}
              {daysLeft !== null && (
                <strong style={{ color: '#fff', marginLeft: 8 }}>
                  ({daysLeft > 0 ? `${daysLeft} days left` : '⚠️ Expired!'})
                </strong>
              )}
            </p>
          )}
        </div>
      )}

      {/* Plan Type Filter */}
      {allPlans.length > 0 && (percentagePlans.length > 0 && monthlyPlans.length > 0) && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.85rem', color: '#374151' }}>Choose payment model:</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setSelectedType('percentage')} style={{ flex: 1, padding: '14px 12px', borderRadius: 12, border: `2px solid ${selectedType === 'percentage' ? '#f97316' : '#e2e8f0'}`, background: selectedType === 'percentage' ? '#fff7ed' : 'white', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>📊</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Pay Per Order</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>% commission</div>
            </button>
            <button onClick={() => setSelectedType('fixed_monthly')} style={{ flex: 1, padding: '14px 12px', borderRadius: 12, border: `2px solid ${selectedType === 'fixed_monthly' ? '#8b5cf6' : '#e2e8f0'}`, background: selectedType === 'fixed_monthly' ? '#f5f3ff' : 'white', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>📅</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Monthly</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>Flat fee</div>
            </button>
          </div>
        </div>
      )}

      {/* Plans List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {allPlans.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b', background: '#f8fafc', borderRadius: 12 }}>
            No plans available
          </div>
        )}
        {filteredPlans.map(plan => {
          const isCurrentPlan = activeSub?.plan_id === plan.id
          return (
            <div key={plan.id} className="card" style={{ border: isCurrentPlan ? '2px solid var(--success)' : `1.5px solid ${plan.plan_type === 'percentage' ? 'rgba(249,115,22,0.3)' : 'rgba(139,92,246,0.3)'}`, position: 'relative', overflow: 'hidden' }}>
              {isCurrentPlan && (
                <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--success)', color: 'white', fontSize: '0.7rem', fontWeight: 800, padding: '3px 12px', borderBottomLeftRadius: 8 }}>
                  CURRENT PLAN
                </div>
              )}
              <div className="flex-between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 3 }}>{plan.name}</div>
                  {plan.description && <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>{plan.description}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {plan.plan_type === 'percentage' ? (
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary)' }}>
                      {plan.fee_percent}%
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>per order</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#8b5cf6' }}>
                      ₹{plan.monthly_fee}
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>/month</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {plan.plan_type === 'fixed_monthly' && <>
                  <span>✓ {plan.duration_days} days validity</span>
                  <span>✓ Keep 100% of earnings</span>
                  {plan.monthly_fee > 0
                    ? <span>✓ Verified via Razorpay</span>
                    : <span>✓ Activate instantly — free</span>
                  }
                </>}
                {plan.plan_type === 'percentage' && <>
                  <span>✓ No upfront payment</span>
                  <span>✓ Auto-deducted from earnings</span>
                  <span>✓ Activate instantly</span>
                </>}
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', background: isCurrentPlan ? 'var(--bg-2)' : plan.plan_type === 'percentage' ? 'var(--primary)' : '#8b5cf6', color: isCurrentPlan ? 'var(--text-muted)' : 'white', cursor: isCurrentPlan ? 'default' : 'pointer' }}
                disabled={isCurrentPlan || purchasing === plan.id}
                onClick={() => buyPlan(plan)}
              >
                {purchasing === plan.id
                  ? '⏳ Processing...'
                  : isCurrentPlan
                    ? '✅ Your Current Plan'
                    : plan.plan_type === 'percentage'
                      ? '🚀 Activate — No Upfront Payment'
                      : plan.monthly_fee <= 0
                        ? '🚀 Activate Free Plan'
                        : `💳 Pay ₹${plan.monthly_fee} & Activate`
                }
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
