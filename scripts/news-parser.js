const Parser = require('rss-parser');
const fs = require('fs');
const fetch = require('node-fetch');

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_KEY) throw new Error('DEEPSEEK_API_KEY not set in GitHub Secrets');

const parser = new Parser({
  customFields: { item: [['media:content','mediaContent'],['media:thumbnail','mediaThumbnail']] }
});

// Берём из разных источников чтобы 5 статей были разнообразными
const RSS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World' },
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' },
  { url: 'https://slator.com/feed/', name: 'Slator' },
  { url: 'https://www.theguardian.com/world/rss', name: 'The Guardian' },
  { url: 'https://rss.dw.com/rdf/rss-en-world', name: 'DW World' },
  { url: 'https://feeds.npr.org/1001/rss.xml', name: 'NPR' },
  { url: 'https://www.nomadicmatt.com/feed/', name: 'Nomadic Matt' }
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
  return 'https://image.pollinations.ai/prompt/' + 
    encodeURIComponent(title.slice(0, 80) + ', travel news photo, cinematic, realistic') + 
    '?width=800&height=450&nologo=true&seed=' + Math.floor(Math.random() * 99999);
}

async function callDeepSeek(title, content) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': 'Bearer ' + DEEPSEEK_KEY 
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: `You are a sharp, witty 30-year-old journalist who has lived in 15 countries. You write for expats, digital nomads, and international travelers. Your style: punchy opener that hooks instantly, clear facts, real-world impact for people living abroad, one insider tip, memorable closer.

Rewrite this news. Return ONLY valid JSON, nothing else:
{
  "title": "Punchy headline with a hook, max 85 chars",
  "summary": "Exactly 5 sentences. Sentence 1: Bold hook that grabs attention. Sentence 2: Core facts of what happened. Sentence 3: Why this matters specifically for expats or travelers. Sentence 4: One practical tip or action they can take. Sentence 5: Witty or thought-provoking closer.",
  "meta_description": "SEO description max 155 chars"
}

Title: ${title}
Content: ${content.slice(0, 800)}`
      }],
      temperature: 0.85,
      max_tokens: 400,
      response_format: { type: 'json_object' }
    })
  });

  if (res.status === 429) return { quotaError: true };
  if (!res.ok) throw new Error('DeepSeek HTTP ' + res.status);

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content.trim());
}

async function main() {
  console.log('=== NEWS PARSER START ===');
  const articles = [];
  const seen = new Set();

  // Берём по 1-2 статьи с каждого источника для разнообразия
  for (const feed of RSS_FEEDS) {
    if (articles.length >= 5) break; // Нужно ровно 5 статей
    
    console.log('Feed:', feed.name);
    let feedData;
    try { feedData = await parser.parseURL(feed.url); }
    catch(e) { console.warn('Skip:', feed.name, e.message); continue; }

    // Берём только 1 лучшую статью с каждого источника
    for (const item of feedData.items.slice(0, 3)) {
      if (articles.length >= 5) break;
      
      const slug = slugify(item.title || '');
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);

      const rawContent = (item.contentSnippet || item.content || item.description || '')
        .replace(/<[^>]*>/g, '').trim();
      
      if (rawContent.length < 50) continue; // Пропускаем пустые

      let title = item.title || '';
      let summary = rawContent.slice(0, 400);
      let meta = title;
      let image = extractImage(item) || generateImage(title);

      try {
        console.log('  AI processing:', title.slice(0, 50));
        const ai = await callDeepSeek(title, rawContent);
        if (ai && !ai.quotaError) {
          title = ai.title || title;
          summary = ai.summary || summary;
          meta = ai.meta_description || meta;
          console.log('  ✅ Done:', title.slice(0, 50));
        } else if (ai && ai.quotaError) {
          console.warn('  ⚠️ Quota exceeded');
        }
      } catch(e) { 
        console.warn('  AI error:', e.message); 
      }

      articles.push({
        slug, title, summary, meta_description: meta,
        image_url: image,
        source_url: item.link || '',
        source_name: feed.name,
        created_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
      });

      await new Promise(r => setTimeout(r, 500));
      break; // Только 1 статья с каждого источника
    }
  }

  fs.writeFileSync('news.json', JSON.stringify({ 
    updated: new Date().toISOString(), 
    articles 
  }, null, 2));
  
  console.log('Saved', articles.length, 'articles to news.json');
  console.log('=== DONE ===');
}

main().catch(e => { 
  console.error('FAILED:', e.message); 
  process.exit(1); 
});
