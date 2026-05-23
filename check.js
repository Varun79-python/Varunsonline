// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://garxraczisrnmvvnotyu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhcnhyYWN6aXNybm12dm5vdHl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ2MDQzNCwiZXhwIjoyMDkzMDM2NDM0fQ.nys_Zppcvras7YuzUo4Bb2DGNwoWFc1SxOyJjcS-j_o'
);

async function check() {
  console.log('=== CHECK ADMIN SHOP QUERY (FIXED) ===\n');

  // Test the query without join
  console.log('1. Test pending docs query (no join):');
  const { data: docs, error } = await supabase
    .from('shop_documents')
    .select('id, user_id, status, shop_photo_url, aadhar_url, created_at')
    .eq('status', 'pending');
  
  console.log('Error:', error ? error.message : 'None');
  console.log('Count:', docs?.length || 0);

  // Get profiles
  const userIds = docs ? docs.map(d => d.user_id).filter(Boolean) : []
  console.log('User IDs:', userIds);
  
  let profileMap = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone').in('id', userIds)
    profileMap = profiles ? profiles.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}) : {}
  }
  
  console.log('Profile map:', Object.keys(profileMap));

  // Map results
  const mapped = docs ? docs.map(doc => ({
    id: doc.id,
    full_name: profileMap[doc.user_id]?.full_name || 'Unknown',
    phone: profileMap[doc.user_id]?.phone || 'Unknown',
  })) : []
  
  console.log('\n2. Mapped results:');
  console.log(mapped);

  console.log('\n=== CHECK COMPLETE ===');
}

check();