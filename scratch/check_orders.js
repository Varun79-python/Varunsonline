const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://garxraczisrnmvvnotyu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhcnhyYWN6aXNybm12dm5vdHl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ2MDQzNCwiZXhwIjoyMDkzMDM2NDM0fQ.nys_Zppcvras7YuzUo4Bb2DGNwoWFc1SxOyJjcS-j_o'
);

async function run() {
  console.log('--- Checking Delivery Agents ---');
  const { data: agents, error: err1 } = await supabase
    .from('delivery_agents')
    .select('*');
  if (err1) console.error('Error fetching agents:', err1.message);
  else {
    console.log(`Found ${agents.length} delivery agents:`);
    agents.forEach(a => {
      console.log(`Agent ID: ${a.id}`);
      console.log(`- Approved: ${a.is_approved}, Available: ${a.is_available}, Active: ${a.is_active}`);
      console.log(`- GPS Lat: ${a.last_lat}, Lng: ${a.last_lon}, Last Updated: ${a.last_updated}`);
    });
  }

  console.log('\n--- Checking Orders ---');
  const { data: orders, error: err2 } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, agent_id, shop_id, address_id,
      shops:shop_id(name, latitude, longitude),
      addresses:address_id(house_name, latitude, longitude)
    `)
    .in('status', ['placed', 'payment_confirmed', 'shop_accepted', 'order_packed']);
  if (err2) console.error('Error fetching orders:', err2.message);
  else {
    console.log(`Found ${orders.length} orders in pending/processing states:`);
    orders.forEach(o => {
      console.log(`Order Number: ${o.order_number}`);
      console.log(`- Status: ${o.status}`);
      console.log(`- Agent ID: ${o.agent_id}`);
      console.log(`- Shop: ${o.shops?.name} (Lat: ${o.shops?.latitude}, Lng: ${o.shops?.longitude})`);
      console.log(`- Address: ${o.addresses?.house_name} (Lat: ${o.addresses?.latitude}, Lng: ${o.addresses?.longitude})`);
    });
  }
}

run();
