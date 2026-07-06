// scripts/sync-reviews.js
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://mcgcijdnzduzyqbbjtkm.supabase.co',
  process.env.SUPABASE_SERVICE_KEY,
  { realtime: { transport: ws } }
);

async function main() {
  console.log('Fetching reviews from Supabase...');
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error('Supabase error: ' + error.message);

  fs.writeFileSync('reviews.json', JSON.stringify({
    updated: new Date().toISOString(),
    reviews: data || []
  }, null, 2));

  console.log('Saved', (data || []).length, 'reviews to reviews.json');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
