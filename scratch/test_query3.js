const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
let envVars = {};
envFile.split('\n').forEach(line => {
  if (line.includes('=')) {
    const [k, v] = line.split('=');
    envVars[k] = v.trim().replace(/^"|"$/g, '');
  }
});

const supabase = createClient(envVars['NEXT_PUBLIC_SUPABASE_URL'], envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function main() {
  const { data: agents } = await supabase.from('delivery_agents').select('*');
  const { data: profiles } = await supabase.from('profiles').select('*').eq('role', 'delivery_agent');
  console.log('agents:', JSON.stringify(agents, null, 2));
  console.log('profiles:', JSON.stringify(profiles, null, 2));
}

main();
