const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://garxraczisrnmvvnotyu.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhcnhyYWN6aXNybm12dm5vdHl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ2MDQzNCwiZXhwIjoyMDkzMDM2NDM0fQ.nys_Zppcvras7YuzUo4Bb2DGNwoWFc1SxOyJjcS-j_o';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const AGENT_ID = '3d37ebdc-0e5d-4354-ab2b-c9813ac3960d';

async function check() {
  console.log('============================================================');
  console.log('🔍 SIMULATING API ROUTE QUERIES FOR AGENT');
  console.log('============================================================\n');

  console.log('Query 1: verifyDeliveryAgent logic...');
  const { data: agent1, error: err1 } = await supabase
    .from('delivery_agents')
    .select('id')
    .eq('id', AGENT_ID)
    .maybeSingle();

  if (err1) {
    console.error('❌ Query 1 error:', err1);
  } else {
    console.log('✅ Query 1 result:', agent1);
  }

  console.log('\nQuery 2: route.ts select query...');
  const { data: agentRow, error: err2 } = await supabase
    .from('delivery_agents')
    .select('is_approved, is_available, is_suspended, is_blocked, last_lat, last_lon, last_updated')
    .eq('id', AGENT_ID)
    .single();

  if (err2) {
    console.error('❌ Query 2 error:', err2);
  } else {
    console.log('✅ Query 2 result:', agentRow);
  }

  console.log('\n============================================================');
}

check();
