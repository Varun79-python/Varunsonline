const { createClient } = require('@supabase/supabase-js');

// Read env variables or fall back to the known development ones from check.js
const SUPABASE_URL = 'https://garxraczisrnmvvnotyu.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhcnhyYWN6aXNybm12dm5vdHl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ2MDQzNCwiZXhwIjoyMDkzMDM2NDM0fQ.nys_Zppcvras7YuzUo4Bb2DGNwoWFc1SxOyJjcS-j_o';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

async function diagnose() {
  console.log('============================================================');
  console.log('🔍 VARUNSONLINE DELIVERY SYSTEM DIAGNOSIS RUNNING');
  console.log('============================================================\n');

  // 1. Fetch Agents
  console.log('⚙️  Step 1: Checking Delivery Agents...');
  const { data: agents, error: agentsErr } = await supabase
    .from('delivery_agents')
    .select('*');

  if (agentsErr) {
    console.error('❌ Failed to fetch delivery agents:', agentsErr.message);
    return;
  }

  if (!agents || agents.length === 0) {
    console.log('❓ No delivery agent profiles found in delivery_agents table.');
  } else {
    console.log(`Found ${agents.length} delivery agents:`);
    agents.forEach(a => {
      console.log(`\n👤 Agent Name: ${a.full_name || 'Unknown'}`);
      console.log(`   - ID: ${a.id}`);
      console.log(`   - Email: ${a.email}`);
      console.log(`   - Approved: ${a.is_approved ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Online/Available: ${a.is_available ? '✅ YES' : '❌ NO (Needs Go ONLINE on page)'}`);
      console.log(`   - Active Status: ${a.is_active ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Suspended: ${a.is_suspended ? '❌ YES (Suspended by Admin)' : '✅ NO'}`);
      console.log(`   - Blocked: ${a.is_blocked ? '❌ YES (Blocked)' : '✅ NO'}`);
      console.log(`   - Last GPS Lat: ${a.last_lat}`);
      console.log(`   - Last GPS Lon: ${a.last_lon}`);
      console.log(`   - GPS Last Updated: ${a.last_updated || a.gps_updated_at || 'Never'}`);
    });
  }

  // 2. Fetch Orders in 'shop_accepted' or 'order_packed'
  console.log('\n📦 Step 2: Checking Orders Ready for Delivery (shop_accepted / order_packed)...');
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, agent_id, shop_id,
      shops:shop_id(name, latitude, longitude),
      addresses:address_id(house_name, latitude, longitude)
    `)
    .in('status', ['shop_accepted', 'order_packed']);

  if (ordersErr) {
    console.error('❌ Failed to fetch orders:', ordersErr.message);
    return;
  }

  if (!orders || orders.length === 0) {
    console.log('❓ No orders are currently in "shop_accepted" or "order_packed" status.');
    // Check if there are any placed/confirmed orders that haven't been accepted yet
    const { data: allOrders } = await supabase
      .from('orders')
      .select('order_number, status')
      .limit(5);
    console.log('   Recent orders in other statuses:', allOrders || 'None');
  } else {
    console.log(`Found ${orders.length} orders ready for delivery:`);
    orders.forEach(o => {
      console.log(`\n🛒 Order #${o.order_number}`);
      console.log(`   - ID: ${o.id}`);
      console.log(`   - Status: ${o.status}`);
      console.log(`   - Assigned Agent ID: ${o.agent_id || 'None (Unassigned)'}`);
      console.log(`   - Shop: ${o.shops?.name} (Lat: ${o.shops?.latitude}, Lng: ${o.shops?.longitude})`);
      console.log(`   - Delivery Address Lat/Lng: ${o.addresses?.latitude}, ${o.addresses?.longitude}`);
    });
  }

  // 3. Match and Simulate Distance Filtering Logic
  console.log('\n🛰️  Step 3: Simulating Radius Filtering Logic...');
  if (agents && agents.length > 0 && orders && orders.length > 0) {
    agents.forEach(agent => {
      console.log(`\n🔍 Evaluating matches for Agent: ${agent.full_name || agent.email}`);
      
      if (!agent.is_approved) {
        console.log(`   ⚠️ Agent is NOT approved. Order visibility is BLOCKED.`);
        return;
      }
      if (!agent.is_available) {
        console.log(`   ⚠️ Agent is OFFLINE. Order visibility is BLOCKED. Toggle ONLINE on UI first.`);
        return;
      }
      if (agent.is_suspended || agent.is_blocked) {
        console.log(`   ⚠️ Agent is suspended/blocked. Order visibility is BLOCKED.`);
        return;
      }

      const agentLat = agent.last_lat;
      const agentLon = agent.last_lon;
      if (agentLat == null || agentLon == null) {
        console.log(`   ⚠️ Agent has no recorded GPS coordinates. Order visibility is BLOCKED.`);
        return;
      }

      orders.forEach(order => {
        if (order.agent_id !== null) {
          console.log(`   Order #${order.order_number} is already assigned to agent ${order.agent_id}. Skipping.`);
          return;
        }

        const shop = order.shops;
        if (!shop || shop.latitude == null || shop.longitude == null) {
          console.log(`   Order #${order.order_number} has shop without coordinates. Filtered out (null distance).`);
          return;
        }

        const dist = haversineKm(agentLat, agentLon, shop.latitude, shop.longitude);
        const withinRadius = dist <= 5; // RADIUS_KM = 5
        console.log(`   Order #${order.order_number} is ${dist.toFixed(3)} km away from Agent.`);
        console.log(`   - Required Radius: <= 5 km`);
        console.log(`   - Is within radius: ${withinRadius ? '✅ YES' : '❌ NO (Too far!)'}`);
      });
    });
  } else {
    console.log('⚠️ Cannot run matching simulation because agents or orders list is empty.');
  }

  console.log('\n============================================================');
  console.log('✅ DIAGNOSIS COMPLETE');
  console.log('============================================================');
}

diagnose();
