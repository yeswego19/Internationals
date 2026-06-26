const Parser = require('rss-parser');
const fs = require('fs');
const fetch = require('node-fetch');

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_KEY) throw new Error('DEEPSEEK_API_KEY not set in GitHub Secrets');

const parser = new Parser({
  customFields: { item: [['media:content','mediaContent'],['media:thumbnail','mediaThumbnail']] }
});

// 4 западных + 1 азиатский обязательно
const RSS_FEEDS_WEST = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World' },
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' },
  { url: 'https://slator.com/feed/', name: 'Slator' },
  { url: 'https://rss.dw.com/rdf/rss-en-world', name: 'DW World' }
];

const RSS_FEEDS_ASIA = [
  { url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416', name: 'CNA Singapore' },
  { url: 'https://thediplomat.com/feed/', name: 'The Diplomat' },
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
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DEEPSEEK_KEY
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: `Ты — Алекс, 30-летний русскоязычный путешественник, переводчик и блогер. Живёшь то в Берлине, то в Стамбуле, то в Бангкоке. Пишешь умно, разговорно, с иронией — как образованный друг который всё повидал.

Перепиши эту новость в своём стиле. Верни ТОЛЬКО валидный JSON, ничего лишнего:
{
  "title": "Цепляющий заголовок на русском, максимум 85 символов",
  "preview": "Одно предложение-крючок для списка новостей на русском",
  "full_text": "Полноценная статья на русском языке. 8-10 предложений. Структура: 1) яркая завязка которая цепляет; 2) суть что произошло — факты; 3) контекст и предыстория; 4) почему это важно для тех кто живёт или путешествует за рубежом; 5) личный взгляд или неожиданный угол; 6) практический совет или вывод; 7) запоминающаяся концовка с лёгкой иронией или мыслью.",
  "meta_description": "SEO описание на русском, максимум 155 символов"
}

Заголовок оригинала: ${title}
Содержание: ${content.slice(0, 1000)}`
      }],
      temperature: 0.85,
      max_tokens: 800,
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

    let title = item.title || '';
    let preview = rawContent.slice(0, 200);
    let full_text = rawContent;
    let meta = title;
    let image = extractImage(item) || generateImage(title);

    try {
      console.log('  AI:', title.slice(0, 50));
      const ai = await callDeepSeek(title, rawContent);
      if (ai && !ai.quotaError) {
        title = ai.title || title;
        preview = ai.preview || preview;
        full_text = ai.full_text || full_text;
        meta = ai.meta_description || meta;
        console.log('  ✅', title.slice(0, 50));
      }
    } catch(e) { console.warn('  AI error:', e.message); }

    return {
      slug, title, preview, full_text, meta_description: meta,
      image_url: image,
      source_url: item.link || '',
      source_name: feed.name,
      created_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
    };
  }
  return null;
}

async function main() {
  console.log('=== NEWS PARSER START ===');
  const articles = [];
  const seen = new Set();

  // Берём 4 статьи из западных источников
  for (const feed of RSS_FEEDS_WEST) {
    if (articles.length >= 4) break;
    console.log('Feed:', feed.name);
    const art = await fetchArticle(feed);
    if (art && !seen.has(art.slug)) {
      seen.add(art.slug);
      articles.push(art);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Обязательно 1 статья из азиатского источника
  console.log('--- Asian source ---');
  for (const feed of RSS_FEEDS_ASIA) {
    console.log('Feed:', feed.name);
    const art = await fetchArticle(feed);
    if (art && !seen.has(art.slug)) {
      seen.add(art.slug);
      articles.push(art);
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  fs.writeFileSync('news.json', JSON.stringify({ updated: new Date().toISOString(), articles }, null, 2));
  console.log('Saved', articles.length, 'articles to news.json');
  console.log('=== DONE ===');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
