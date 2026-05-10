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
        .select('wallet_balance, total_earnings, today_earnings')
        .eq('id', order.agent_id)
        .single()
      
      if (agent) {
        await supabase
          .from('delivery_agents')
          .update({
            wallet_balance: (agent.wallet_balance || 0) + order.agent_earning,
            total_earnings: (agent.total_earnings || 0) + order.agent_earning,
            today_earnings: (agent.today_earnings || 0) + order.agent_earning,
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
      // Get current shop
      const { data: shop } = await supabase
        .from('shops')
        .select('id, wallet_balance, total_earnings, owner_id')
        .eq('id', order.shop_id)
        .single()
      
      if (shop) {
        await supabase
          .from('shops')
          .update({
            wallet_balance: (shop.wallet_balance || 0) + order.shopkeeper_earning,
            total_earnings: (shop.total_earnings || 0) + order.shopkeeper_earning,
          })
          .eq('id', shop.id)

        await supabase.from('wallet_transactions').insert({
          user_id: shop.owner_id, // shop owner gets the transaction record
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
