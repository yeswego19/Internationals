const Parser = require('rss-parser');
const fs = require('fs');
const fetch = require('node-fetch');

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || 'sk-9605f229c23845868dad52afc10e3bf0';

const parser = new Parser({
  customFields: { item: [['media:content','mediaContent'],['media:thumbnail','mediaThumbnail']] }
});

const RSS_FEEDS = [
  { url: 'https://www.nomadicmatt.com/feed/', name: 'Nomadic Matt' },
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World' },
  { url: 'https://slator.com/feed/', name: 'Slator' },
  { url: 'https://www.theguardian.com/world/rss', name: 'The Guardian' },
  { url: 'https://feeds.npr.org/1001/rss.xml', name: 'NPR' },
  { url: 'https://rss.dw.com/rdf/rss-en-world', name: 'DW World' }
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
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(title.slice(0, 80) + ', travel news photo, realistic, high quality') + '?width=800&height=450&nologo=true&seed=' + Math.floor(Math.random()*9999);
}

async function callDeepSeek(title, content) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: `You are Alex — a witty, smart 30-year-old world traveler writing news for expats and nomads.
Rewrite this news in your voice. Return ONLY valid JSON, nothing else:
{"title":"catchy headline for expats max 90 chars","summary":"exactly 5 sentences: what happened, why expats should care, one practical tip, local angle, witty closing","meta_description":"SEO max 155 chars"}

Title: ${title}
Content: ${content.slice(0, 1000)}`
      }],
      temperature: 0.8,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    })
  });

  if (res.status === 429) return { quotaError: true };
  if (!res.ok) throw new Error('DeepSeek ' + res.status);

  const data = await res.json();
  const text = data.choices[0].message.content.trim();
  return JSON.parse(text);
}

async function main() {
  console.log('=== NEWS PARSER START ===');
  const articles = [];
  const seen = new Set();

  for (const feed of RSS_FEEDS) {
    console.log('Feed:', feed.name);
    let feedData;
    try { feedData = await parser.parseURL(feed.url); }
    catch(e) { console.warn('Skip:', feed.name, e.message); continue; }

    const items = feedData.items.slice(0, 5);
    for (const item of items) {
      const slug = slugify(item.title || '');
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);

      const rawContent = (item.contentSnippet || item.content || item.description || '').replace(/<[^>]*>/g, '');
      let title = item.title || '';
      let summary = rawContent.slice(0, 500);
      let meta = title;
      let image = extractImage(item) || generateImage(title);

      try {
        const ai = await callDeepSeek(title, rawContent);
        if (ai && !ai.quotaError) {
          title = ai.title || title;
          summary = ai.summary || summary;
          meta = ai.meta_description || meta;
        }
      } catch(e) { console.warn('AI error:', e.message); }

      articles.push({
        slug, title, summary, meta_description: meta,
        image_url: image,
        source_url: item.link || '',
        source_name: feed.name,
        created_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
      });

      console.log('✅', title.slice(0, 60));
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // Сохраняем как статический JSON файл в репозиторий
  fs.writeFileSync('news.json', JSON.stringify({ updated: new Date().toISOString(), articles }, null, 2));
  console.log('Saved', articles.length, 'articles to news.json');
  console.log('=== DONE ===');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
