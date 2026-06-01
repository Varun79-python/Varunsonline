const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://garxraczisrnmvvnotyu.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhcnhyYWN6aXNybm12dm5vdHl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ2MDQzNCwiZXhwIjoyMDkzMDM2NDM0fQ.nys_Zppcvras7YuzUo4Bb2DGNwoWFc1SxOyJjcS-j_o';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function check() {
  console.log('============================================================');
  console.log('🛡️  CHECKING DATABASE RLS POLICIES FOR ORDERS TABLE');
  console.log('============================================================\n');

  console.log('📱 Checking active order state for Agent (3d37ebdc-0e5d-4354-ab2b-c9813ac3960d)...');
  const { data: activeOrders, error: activeErr } = await supabase
    .from('orders')
    .select('id, order_number, status')
    .eq('agent_id', '3d37ebdc-0e5d-4354-ab2b-c9813ac3960d')
    .in('status', ['agent_assigned', 'picked_up', 'out_for_delivery']);

  if (activeErr) {
    console.error('❌ Error fetching active orders:', activeErr.message);
  } else if (activeOrders && activeOrders.length > 0) {
    console.log(`❌ Agent already has ${activeOrders.length} active orders assigned! This BLOCKS receiving new available orders.`);
    activeOrders.forEach(o => {
      console.log(`   - Order #${o.order_number} (Status: ${o.status})`);
    });
  } else {
    console.log('✅ Agent has 0 active orders. Ready to receive available orders!');
  }

  console.log('\n📝 Attempting to check RLS status on orders table...');
  try {
    const { data: rawPolicies, error: rawErr } = await supabase.rpc('execute_sql_query', {
      sql: "SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'orders';"
    });
    
    if (rawErr) {
      console.log('⚠️ Supabase SQL RPC failed/disabled (this is normal in development).');
      console.log('   Please make sure you have manually run the SQL scripts in your Supabase SQL Editor:');
      console.log('   1. Open the file: run_these_in_supabase.sql');
      console.log('   2. Copy all its contents, paste them in the Supabase SQL editor, and click "Run".');
    } else if (rawPolicies) {
      console.log('Found policies:', rawPolicies);
    }
  } catch (e) {
    console.log('⚠️ Could not fetch pg_policies catalog directly. Standard check completed.');
  }

  console.log('\n============================================================');
}

check();
