// scripts/sync-reviews.js
// Забирает отзывы из Supabase и сохраняет reviews.json в репозиторий
// Запускается через GitHub Actions 2 раза в день

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://mcgcijdnzduzyqbbjtkm.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('Fetching reviews from Supabase...');

  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error('Supabase error: ' + error.message);

  const result = {
    updated: new Date().toISOString(),
    reviews: data || []
  };

  fs.writeFileSync('reviews.json', JSON.stringify(result, null, 2));
  console.log('Saved', result.reviews.length, 'reviews to reviews.json');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
