const Parser = require('rss-parser');
const fs = require('fs');
const fetch = require('node-fetch');

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_KEY) throw new Error('DEEPSEEK_API_KEY not set in GitHub Secrets');

const parser = new Parser({
  customFields: { item: [['media:content','mediaContent'],['media:thumbnail','mediaThumbnail']] }
});

const RSS_FEEDS_WEST = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World' },
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' },
  { url: 'https://slator.com/feed/', name: 'Slator' },
  { url: 'https://rss.dw.com/rdf/rss-en-world', name: 'DW World' }
];

const RSS_FEEDS_ASIA = [
  { url: 'https://thediplomat.com/feed/', name: 'The Diplomat' },
  { url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416', name: 'CNA Singapore' },
  { url: 'https://china.org.cn/rss/1201719.xml', name: 'China.org.cn' }
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
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: `You are Alex — a sharp, witty 30-year-old translator and travel blogger who has lived in Berlin, Istanbul and Bangkok. You write smart, conversational prose with a touch of irony, like an educated friend who has seen it all.

Rewrite this news article in TWO languages. Return ONLY valid JSON, nothing else:
{
  "title_en": "Punchy English headline with a hook, max 85 chars",
  "title_ru": "Цепляющий заголовок на русском, максимум 85 символов",
  "preview_en": "One-sentence hook for the news list in English",
  "preview_ru": "Одно предложение-крючок для списка новостей на русском",
  "full_en": "Full article in English, 8-10 sentences. Structure: 1) bold hook; 2) core facts; 3) context; 4) why it matters for expats/travelers; 5) personal angle; 6) practical tip; 7) witty closing.",
  "full_ru": "Полная статья на русском, 8-10 предложений. Структура: 1) яркая завязка; 2) суть и факты; 3) контекст; 4) почему важно для тех кто живёт или ездит за рубеж; 5) личный взгляд; 6) практический совет; 7) запоминающаяся концовка с иронией.",
  "meta_en": "SEO description in English, max 155 chars",
  "meta_ru": "SEO описание на русском, максимум 155 символов"
}

Original title: ${title}
Content: ${content.slice(0, 1000)}`
      }],
      temperature: 0.85,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    })
  });

  if (res.status === 429) return { quotaError: true };
  if (!res.ok) throw new Error('DeepSeek HTTP ' + res.status);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content.trim());
}

async function fetchArticle(feed) {
  let feedData;
  try { feedData = await parser.parseURL(feed.url); }
  catch(e) { console.warn('Skip:', feed.name, e.message); return null; }

  for (const item of feedData.items.slice(0, 5)) {
    const rawContent = (item.contentSnippet || item.content || item.description || '')
      .replace(/<[^>]*>/g, '').trim();
    if (rawContent.length < 50) continue;

    const slug = slugify(item.title || '');
    if (!slug) continue;

    let image = extractImage(item) || generateImage(item.title || '');
    let result = {
      slug,
      title_en: item.title || '',
      title_ru: item.title || '',
      preview_en: rawContent.slice(0, 200),
      preview_ru: rawContent.slice(0, 200),
      full_en: rawContent,
      full_ru: rawContent,
      meta_en: item.title || '',
      meta_ru: item.title || '',
      image_url: image,
      source_url: item.link || '',
      source_name: feed.name,
      created_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
    };

    try {
      console.log('  AI:', (item.title || '').slice(0, 50));
      const ai = await callDeepSeek(item.title || '', rawContent);
      if (ai && !ai.quotaError) {
        result.title_en = ai.title_en || result.title_en;
        result.title_ru = ai.title_ru || result.title_ru;
        result.preview_en = ai.preview_en || result.preview_en;
        result.preview_ru = ai.preview_ru || result.preview_ru;
        result.full_en = ai.full_en || result.full_en;
        result.full_ru = ai.full_ru || result.full_ru;
        result.meta_en = ai.meta_en || result.meta_en;
        result.meta_ru = ai.meta_ru || result.meta_ru;
        console.log('  ✅', result.title_en.slice(0, 50));
      }
    } catch(e) { console.warn('  AI error:', e.message); }

    return result;
  }
  return null;
}

async function main() {
  console.log('=== NEWS PARSER START ===');
  const articles = [];
  const seen = new Set();

  for (const feed of RSS_FEEDS_WEST) {
    if (articles.length >= 4) break;
    console.log('Feed:', feed.name);
    const art = await fetchArticle(feed);
    if (art && !seen.has(art.slug)) { seen.add(art.slug); articles.push(art); }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('--- Asian source ---');
  for (const feed of RSS_FEEDS_ASIA) {
    console.log('Feed:', feed.name);
    const art = await fetchArticle(feed);
    if (art && !seen.has(art.slug)) { seen.add(art.slug); articles.push(art); break; }
    await new Promise(r => setTimeout(r, 500));
  }

  fs.writeFileSync('news.json', JSON.stringify({ updated: new Date().toISOString(), articles }, null, 2));
  console.log('Saved', articles.length, 'articles to news.json');
  console.log('=== DONE ===');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
