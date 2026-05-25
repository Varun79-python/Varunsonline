import { SupabaseClient } from '@supabase/supabase-js'

/**
 * processEarnings — Credits wallets for delivered orders.
 *
 * STRICT BUSINESS RULES:
 *   - shopkeeperEarning = subtotal (100%) — NO deductions
 *   - agentEarning = deliveryCharge (100%)
 *   - adminEarning = platformFee (100%)
 *
 * AUTO-RECOVERY:
 *   If agent has pending COD dues, earnings are auto-recovered
 *   until the debt is cleared. Agent sees transparent ledger.
 */
export async function processEarnings(supabase: SupabaseClient, orderId: string) {
  try {
    // 1. Fetch order details with shop owner
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, order_number, agent_id, agent_earning, shop_id, shopkeeper_earning, shops (owner_id)')
      .eq('id', orderId)
      .single()

    if (fetchErr || !order) {
      console.error('Failed to fetch order for earnings processing:', fetchErr)
      return
    }

    // 2. Process Agent Earnings (with auto-recovery from COD dues)
    if (order.agent_id && order.agent_earning > 0) {
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('wallet_balance, total_earnings, today_earnings, total_deliveries, pending_cod_due')
        .eq('id', order.agent_id)
        .single()

      if (agent) {
        const earned = order.agent_earning
        const pendingDue = Math.max(0, agent.pending_cod_due || 0)

        // Auto-recovery: deduct pending COD dues from current earning
        let netCredit = earned
        let recoveredAmount = 0

        if (pendingDue > 0) {
          recoveredAmount = Math.min(earned, pendingDue)
          netCredit = earned - recoveredAmount
        }

        // Credit net amount to wallet (0 if fully recovered)
        await supabase
          .from('delivery_agents')
          .update({
            wallet_balance: (agent.wallet_balance || 0) + netCredit,
            total_earnings: (agent.total_earnings || 0) + earned,
            today_earnings: (agent.today_earnings || 0) + earned,
            total_deliveries: (agent.total_deliveries || 0) + 1,
            pending_cod_due: pendingDue - recoveredAmount,
          })
          .eq('id', order.agent_id)

        // If recovery happened, update COD settlement ledger
        if (recoveredAmount > 0) {
          // Update the oldest unsettled entry first
          const { data: oldestLedger } = await supabase
            .from('agent_cod_settlement_ledger')
            .select('id, amount_owed_to_platform, settled_amount, pending_amount')
            .eq('agent_id', order.agent_id)
            .in('status', ['pending', 'partially_paid'])
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()  // SAFE: returns null instead of throwing

          if (oldestLedger) {
            const newSettled = (oldestLedger.settled_amount || 0) + recoveredAmount
            const newPending = Math.max(0, oldestLedger.amount_owed_to_platform - newSettled)

            await supabase
              .from('agent_cod_settlement_ledger')
              .update({
                settled_amount: newSettled,
                pending_amount: newPending,
                status: newPending <= 0 ? 'settled' : 'partially_paid',
                settled_at: newPending <= 0 ? new Date().toISOString() : null,
                notes: `Auto-recovered ₹${recoveredAmount} from delivery earnings`
              })
              .eq('id', oldestLedger.id)
          }
        }

        // Record wallet transaction — skip if netCredit is 0 (fully recovered)
        if (netCredit > 0) {
          const txnDescription = recoveredAmount > 0
            ? `Earnings for order ${order.order_number} (₹${recoveredAmount} auto-recovered from COD dues, ₹${netCredit} credited)`
            : `Earnings for order ${order.order_number}`

          await supabase.from('wallet_transactions').insert({
            user_id: order.agent_id,
            user_type: 'delivery_agent',
            type: 'credit',
            amount: netCredit,
            description: txnDescription,
            order_id: order.id
          })
        } else if (recoveredAmount > 0) {
          // Fully recovered — record a recovery-only transaction for transparency
          await supabase.from('wallet_transactions').insert({
            user_id: order.agent_id,
            user_type: 'delivery_agent',
            type: 'info',
            amount: recoveredAmount,
            description: `₹${recoveredAmount} auto-recovered from earnings toward COD settlement (order ${order.order_number}). Remaining COD Due: pending_cod_due value`,
            order_id: order.id
          })
        }
      }
    }

    // 3. Process Shopkeeper Earnings
    // STRICT: shopkeeper gets 100% of items total — NO deductions
    // Subscriptions are charged separately (Razorpay), NOT deducted from order earnings
    if (order.shop_id && order.shopkeeper_earning > 0) {
      const { data: shop } = await supabase
        .from('shops')
        .select('id, wallet_balance, total_earnings, owner_id, total_orders')
        .eq('id', order.shop_id)
        .single()

      if (shop) {
        await supabase
          .from('shops')
          .update({
            wallet_balance: (shop.wallet_balance || 0) + order.shopkeeper_earning,
            total_earnings: (shop.total_earnings || 0) + order.shopkeeper_earning,
            total_orders: (shop.total_orders || 0) + 1,
          })
          .eq('id', shop.id)

        await supabase.from('wallet_transactions').insert({
          user_id: shop.owner_id,
          user_type: 'shopkeeper',
          type: 'credit',
          amount: order.shopkeeper_earning,
          description: `Earnings for order ${order.order_number}`,
          order_id: order.id
        })
      }
    }
  } catch (error) {
    console.error('Error processing earnings:', error)
  }
}
