const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
let envVars = {};
envFile.split('\n').forEach(line => {
  if (line.includes('=')) {
    const [k, v] = line.split('=');
    envVars[k] = v.trim();
  }
});

const supabase = createClient(envVars['NEXT_PUBLIC_SUPABASE_URL'], envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function main() {
  const { data, error } = await supabase.from('delivery_agents')
    .select('*, profiles(full_name, phone, email)');
  console.log(JSON.stringify(data, null, 2));
}

main();
