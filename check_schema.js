const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://garxraczisrnmvvnotyu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhcnhyYWN6aXNybm12dm5vdHl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ2MDQzNCwiZXhwIjoyMDkzMDM2NDM0fQ.nys_Zppcvras7YuzUo4Bb2DGNwoWFc1SxOyJjcS-j_o'
);

const TABLES = [
  'profiles', 'shops', 'shop_documents', 'products', 'customers',
  'addresses', 'delivery_agents', 'coupons', 'orders', 'order_items',
  'order_status_history', 'payments', 'wallet_transactions', 'withdraw_requests',
  'notifications', 'order_conversations', 'order_messages', 'reviews',
  'platform_settings', 'complaints', 'user_tokens'
];

async function getSchema() {
  console.log('=== DATABASE SCHEMA ===\n');
  
  for (const table of TABLES) {
    try {
      // Try to get one row to see columns
      const { data, error } = await supabase.from(table).select('*').limit(1);
      
      console.log(`--- ${table} ---`);
      if (data && data.length > 0) {
        console.log(Object.keys(data[0]).map(k => `  ${k}`).join('\n'));
      } else if (error) {
        console.log(`  ERROR: ${error.message}`);
      } else {
        console.log('  [Empty table - no columns detected]');
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }

  console.log('\n=== DATA SAMPLE (non-empty tables) ===\n');
  for (const table of TABLES) {
    try {
      const { data, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (count > 0) {
        console.log(`${table}: ${count} rows`);
      }
    } catch (e) {}
  }
}

getSchema();