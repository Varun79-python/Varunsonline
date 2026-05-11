import { SupabaseClient } from '@supabase/supabase-js'

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

    // 2. Process Agent Earnings
    if (order.agent_id && order.agent_earning > 0) {
      // Get current agent
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('wallet_balance, total_earnings, today_earnings, total_deliveries')
        .eq('id', order.agent_id)
        .single()
      
      if (agent) {
        await supabase
          .from('delivery_agents')
          .update({
            wallet_balance: (agent.wallet_balance || 0) + order.agent_earning,
            total_earnings: (agent.total_earnings || 0) + order.agent_earning,
            today_earnings: (agent.today_earnings || 0) + order.agent_earning,
            total_deliveries: (agent.total_deliveries || 0) + 1,
          })
          .eq('id', order.agent_id)

        await supabase.from('wallet_transactions').insert({
          user_id: order.agent_id,
          user_type: 'delivery_agent',
          type: 'credit',
          amount: order.agent_earning,
          description: `Earnings for order ${order.order_number}`,
          order_id: order.id
        })
      }
    }

    // 3. Process Shopkeeper Earnings
    if (order.shop_id && order.shopkeeper_earning > 0) {
      // Get current shop (including subscription fee percent)
      const { data: shop } = await supabase
        .from('shops')
        .select('id, wallet_balance, total_earnings, owner_id, total_orders, subscription_fee_percent')
        .eq('id', order.shop_id)
        .single()
      
      if (shop) {
        // Apply subscription fee deduction if shop is on a percentage plan
        const feePercent = shop.subscription_fee_percent || 0
        const feeDeducted = feePercent > 0 ? parseFloat(((order.shopkeeper_earning * feePercent) / 100).toFixed(2)) : 0
        const netEarning = parseFloat((order.shopkeeper_earning - feeDeducted).toFixed(2))

        await supabase
          .from('shops')
          .update({
            wallet_balance: (shop.wallet_balance || 0) + netEarning,
            total_earnings: (shop.total_earnings || 0) + netEarning,
            total_orders: (shop.total_orders || 0) + 1,
          })
          .eq('id', shop.id)

        await supabase.from('wallet_transactions').insert({
          user_id: shop.owner_id,
          user_type: 'shopkeeper',
          type: 'credit',
          amount: netEarning,
          description: feeDeducted > 0
            ? `Earnings for order ${order.order_number} (₹${feeDeducted} platform fee deducted)`
            : `Earnings for order ${order.order_number}`,
          order_id: order.id
        })
      }
    }
  } catch (error) {
    console.error('Error processing earnings:', error)
  }
}
