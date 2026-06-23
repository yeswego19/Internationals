const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const parser = new Parser({
  customFields: { item: [['media:content','mediaContent'],['media:thumbnail','mediaThumbnail']] }
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !GEMINI_KEY) {
  throw new Error("Missing environment variables!");
}

// Источники: путешествия, технологии, мировые новости, языки, бизнес
const RSS_FEEDS = [
  { url: 'https://www.nomadicmatt.com/feed/', name: 'Nomadic Matt' },
  { url: 'https://www.lonelyplanet.com/news/feed', name: 'Lonely Planet' },
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World' },
  { url: 'https://slator.com/feed/', name: 'Slator' },
  { url: 'https://www.theguardian.com/world/rss', name: 'The Guardian' },
  { url: 'https://feeds.npr.org/1001/rss.xml', name: 'NPR' }
];

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '').slice(0, 80);
}

function extractImage(item) {
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) return item.mediaContent.$.url;
  if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) return item.mediaThumbnail.$.url;
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  const html = item['content:encoded'] || item.content || item.description || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function generateImage(title) {
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(title.slice(0, 80) + ', travel photo, realistic') + '?width=800&height=450&nologo=true';
}

async function callGemini(title, content) {
  const prompt = `You are Alex — a witty, smart 30-year-old world traveler writing for expats and nomads.
Rewrite this news in your voice. Return ONLY valid JSON, no markdown:
{"title":"engaging headline for expats max 90 chars","summary":"exactly 5 sentences: what happened, why it matters for people living abroad or traveling, one practical insight, and a witty closing observation","meta_description":"SEO description max 155 chars"}

Title: ${title}
Content: ${content.slice(0, 1200)}`;

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
      })
    }
  );

  if (res.status === 429) return { quotaError: true };
  if (!res.ok) throw new Error('Gemini ' + res.status);

  const data = await res.json();
  const text = data.candidates[0].content.parts[0].text.trim()
    .replace(/^```json\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  return JSON.parse(text);
}

async function main() {
  console.log('=== NEWS PARSER START ===');

  // Очищаем старые статьи
  await supabase.from('articles').delete().neq('id', 0);
  console.log('DB cleaned');

  for (const feed of RSS_FEEDS) {
    console.log('\nFeed:', feed.name);
    let feedData;
    try { feedData = await parser.parseURL(feed.url); }
    catch(e) { console.warn('Skip:', feed.name, e.message); continue; }

    const items = feedData.items.slice(0, 5);
    for (const item of items) {
      const slug = slugify(item.title || '');
      if (!slug) continue;

      // Проверяем дубликат
      const { data: ex } = await supabase.from('articles').select('id').eq('slug', slug).maybeSingle();
      if (ex) continue;

      const rawContent = (item.contentSnippet || item.content || item.description || '').replace(/<[^>]*>/g, '');
      let title = item.title || '';
      let summary = rawContent.slice(0, 500);
      let meta = title;

      // Картинка из RSS или Pollinations
      let image = extractImage(item);
      if (!image) image = generateImage(title);

      // AI обработка
      try {
        const ai = await callGemini(title, rawContent);
        if (ai && !ai.quotaError) {
          title = ai.title || title;
          summary = ai.summary || summary;
          meta = ai.meta_description || meta;
        } else if (ai && ai.quotaError) {
          console.warn('Quota exceeded, using raw RSS');
        }
      } catch(e) { console.warn('AI error:', e.message); }

      const { error } = await supabase.from('articles').insert([{
        slug, title, summary,
        meta_description: meta,
        image_url: image,
        source_url: item.link || '',
        source_name: feed.name,
        created_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
      }]);

      if (error) console.error('Insert error:', error.message);
      else console.log('✅', title.slice(0, 60));

      await new Promise(r => setTimeout(r, 2500));
    }
  }
  console.log('\n=== DONE ===');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
