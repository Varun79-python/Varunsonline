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
  subscription_plans: { name: string; plan_type: string; monthly_fee: number }
}

declare global { interface Window { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } } }

export default function ShopkeeperPlans() {
  const supabase = createClient()
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [shopId, setShopId] = useState<string | null>(null)
  const [activeSub, setActiveSub] = useState<ShopSub | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: shop } = await supabase.from('shops').select('id, subscription_plan_id, subscription_expires_at').eq('owner_id', user.id).single()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)

      // Active subscription
      const { data: sub } = await supabase.from('shop_subscriptions')
        .select('*, subscription_plans(name, plan_type, monthly_fee)')
        .eq('shop_id', shop.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      setActiveSub(sub)

      // All available plans
      const { data: p } = await supabase.from('subscription_plans').select('*').eq('is_active', true).order('monthly_fee')
      setPlans(p || [])
      setLoading(false)
    }
    load()
  }, [])

  async function buyPlan(plan: Plan) {
    if (!shopId || purchasing) return
    if (plan.plan_type === 'percentage') {
      // Percentage plan: just activate, no upfront payment
      setPurchasing(plan.id)
      const now = new Date()
      await supabase.from('shop_subscriptions').insert({
        shop_id: shopId, plan_id: plan.id, payment_status: 'paid',
        starts_at: now.toISOString(), expires_at: null, is_active: true
      })
      await supabase.from('shops').update({ subscription_plan_id: plan.id, is_active: true, subscription_fee_percent: plan.fee_percent }).eq('id', shopId)
      setMsg({ text: `✅ Percentage plan activated! ${plan.fee_percent}% will be deducted per order automatically.`, ok: true })
      setPurchasing(null)
      router.refresh()
      return
    }

    // Fixed monthly — pay via Razorpay
    setPurchasing(plan.id)
    try {
      const res = await fetch('/api/shopkeeper/create-subscription-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, shopId, amount: plan.monthly_fee })
      })
      const { orderId, key, error } = await res.json()
      if (error) { setMsg({ text: `❌ ${error}`, ok: false }); setPurchasing(null); return }

      const rz = new window.Razorpay({
        key,
        amount: plan.monthly_fee * 100,
        currency: 'INR',
        name: "Varun's Online",
        description: `${plan.name} Subscription`,
        order_id: orderId,
        handler: async (response: Record<string, string>) => {
          const verifyRes = await fetch('/api/shopkeeper/verify-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature, planId: plan.id, shopId, durationDays: plan.duration_days })
          })
          const vd = await verifyRes.json()
          if (vd.success) {
            setMsg({ text: `✅ Subscription activated! Your shop is now live for ${plan.duration_days} days.`, ok: true })
            setTimeout(() => router.push('/shopkeeper'), 2000)
          } else {
            setMsg({ text: `❌ Payment verification failed: ${vd.error}`, ok: false })
          }
          setPurchasing(null)
        },
        prefill: {},
        theme: { color: '#f97316' }
      })
      rz.open()
    } catch {
      setMsg({ text: '❌ Payment failed. Try again.', ok: false })
      setPurchasing(null)
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>

  const expiresAt = activeSub?.expires_at ? new Date(activeSub.expires_at) : null
  const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86400000) : null

  return (
    <div className="fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      <h2 style={{ marginBottom: 6 }}>🏪 Subscription Plans</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.88rem' }}>Choose a plan to activate your shop. Your shop is visible to customers only when plan is active.</p>

      {msg && (
        <div style={{ background: msg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 10, padding: '14px 16px', marginBottom: 20, color: msg.ok ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{msg.text}</div>
      )}

      {/* Active Subscription Banner */}
      {activeSub && (
        <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.1))', border: '1.5px solid rgba(34,197,94,0.4)', borderRadius: 14, padding: '18px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: '1.4rem' }}>✅</span>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--success)' }}>Active Plan: {activeSub.subscription_plans?.name}</span>
          </div>
          {activeSub.subscription_plans?.plan_type === 'percentage'
            ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Percentage-based — deducted per order automatically</p>
            : <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                {expiresAt ? `Expires: ${expiresAt.toLocaleDateString('en-IN')}` : ''}&nbsp;
                {daysLeft !== null && (
                  <span style={{ fontWeight: 700, color: daysLeft <= 5 ? 'var(--danger)' : daysLeft <= 10 ? '#d97706' : 'var(--success)' }}>
                    ({daysLeft > 0 ? `${daysLeft} days left` : '⚠️ Expired!'})
                  </span>
                )}
              </p>
          }
        </div>
      )}

      {/* Plans Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {plans.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No plans available. Contact admin.</div>}
        {plans.map(plan => {
          const isCurrentPlan = activeSub?.plan_id === plan.id
          return (
            <div key={plan.id} className="card" style={{ border: isCurrentPlan ? '2px solid var(--success)' : '1.5px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
              {isCurrentPlan && <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--success)', color: 'white', fontSize: '0.7rem', fontWeight: 800, padding: '3px 10px', borderBottomLeftRadius: 8 }}>CURRENT</div>}
              <div className="flex-between" style={{ marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 3 }}>{plan.name}</div>
                  {plan.description && <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>{plan.description}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {plan.plan_type === 'percentage'
                    ? <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary)' }}>{plan.fee_percent}%<span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>/order</span></div>
                    : <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#8b5cf6' }}>₹{plan.monthly_fee}<span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>/month</span></div>
                  }
                </div>
              </div>
              {plan.plan_type === 'fixed_monthly' && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>✓ {plan.duration_days} days validity &nbsp;·&nbsp; ✓ Unlimited orders &nbsp;·&nbsp; ✓ Auto verified via Razorpay</div>
              )}
              {plan.plan_type === 'percentage' && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>✓ No upfront payment &nbsp;·&nbsp; ✓ Pay only when you earn &nbsp;·&nbsp; ✓ Auto deducted per order</div>
              )}
              <button
                className="btn btn-primary"
                style={{ width: '100%', background: plan.plan_type === 'percentage' ? 'var(--primary)' : '#8b5cf6', opacity: isCurrentPlan ? 0.5 : 1 }}
                disabled={isCurrentPlan || purchasing === plan.id}
                onClick={() => buyPlan(plan)}
              >
                {purchasing === plan.id ? 'Processing...' : isCurrentPlan ? '✅ Current Plan' : plan.plan_type === 'percentage' ? 'Activate Free Plan' : `Pay ₹${plan.monthly_fee} →`}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
