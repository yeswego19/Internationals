const Parser = require('rss-parser');
const fs = require('fs');
const fetch = require('node-fetch');

const GROQ_KEY = process.env.GROQ_API_KEY;

const parser = new Parser({
  customFields: { item: [['media:content','mediaContent'],['media:thumbnail','mediaThumbnail']] }
});

const RSS_FEEDS_WEST = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World' },
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' },
  { url: 'https://rss.dw.com/rdf/rss-en-world', name: 'DW World' },
  { url: 'https://feeds.npr.org/1001/rss.xml', name: 'NPR' }
];

const RSS_FEEDS_ASIA = [
  { url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416', name: 'CNA Singapore' },
  { url: 'https://thediplomat.com/feed/', name: 'The Diplomat' }
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
    '?width=1024&height=576&nologo=true&seed=' + Math.floor(Math.random() * 99999);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// Очищаем текст от markdown и нежелательных символов
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '')           // убираем **bold**
    .replace(/\*/g, '')             // убираем *italic*
    .replace(/#{1,6}\s/g, '')       // убираем заголовки
    .replace(/[^\x00-\x7F\u0400-\u04FF\u00C0-\u024F\s.,!?:;()\-–—"'«»]/g, '') // убираем иероглифы и нелатинские символы кроме кириллицы и базовой латиницы
    .replace(/\s+/g, ' ')
    .trim();
}

const PROMPT = (title, content) => `You are Alex — a sharp, witty 30-year-old translator and travel journalist. Write smart, conversational prose.

CRITICAL RULES:
- Russian text must contain ONLY Cyrillic characters, standard punctuation, and Arabic numerals. NO Latin letters, NO Chinese/Japanese/Korean characters, NO markdown symbols like ** or *.
- English text must contain ONLY Latin characters and standard punctuation.
- Do NOT use markdown formatting anywhere.

Rewrite this news. Return ONLY valid JSON:
{
  "title_en": "Punchy English headline, max 85 chars, no markdown",
  "title_ru": "Заголовок ТОЛЬКО на русском языке, без латиницы, максимум 85 символов",
  "preview_en": "One sentence hook in English only",
  "preview_ru": "Одно предложение только на русском языке без латинских букв",
  "full_en": "7 sentences in English only: 1) hook; 2) facts; 3) context; 4) why matters for expats; 5) personal angle; 6) practical tip; 7) witty closing.",
  "full_ru": "7 предложений ТОЛЬКО на русском языке, без латинских букв и иероглифов: 1) завязка; 2) факты; 3) контекст; 4) важно для экспатов; 5) личный взгляд; 6) практический совет; 7) ироничная концовка.",
  "meta_en": "SEO description English only, max 155 chars",
  "meta_ru": "SEO описание только на русском, максимум 155 символов"
}

Title: ${title}
Content: ${content.slice(0, 800)}`;

async function callGroq(title, content) {
  if (!GROQ_KEY) throw new Error('No GROQ_API_KEY');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: PROMPT(title, content) }],
      temperature: 0.7,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Groq HTTP ' + res.status + ': ' + err.slice(0, 200));
  }
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content.trim());
  // Очищаем все текстовые поля
  return {
    title_en: cleanText(parsed.title_en || ''),
    title_ru: cleanText(parsed.title_ru || ''),
    preview_en: cleanText(parsed.preview_en || ''),
    preview_ru: cleanText(parsed.preview_ru || ''),
    full_en: cleanText(parsed.full_en || ''),
    full_ru: cleanText(parsed.full_ru || ''),
    meta_en: cleanText(parsed.meta_en || ''),
    meta_ru: cleanText(parsed.meta_ru || '')
  };
}

function rssFallback(title, content) {
  const sentences = content.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter(s => s.length > 20);
  const full = sentences.slice(0, 7).join(' ');
  const preview = sentences[0] || title;
  return {
    title_en: title.slice(0, 85),
    title_ru: title.slice(0, 85),
    preview_en: preview.slice(0, 200),
    preview_ru: preview.slice(0, 200),
    full_en: full || title,
    full_ru: full || title,
    meta_en: title.slice(0, 155),
    meta_ru: title.slice(0, 155)
  };
}

async function fetchArticle(feed) {
  let feedData;
  try { feedData = await parser.parseURL(feed.url); }
  catch(e) { console.warn('Skip feed:', feed.name, e.message); return null; }

  for (const item of feedData.items.slice(0, 5)) {
    const rawContent = (item.contentSnippet || item.content || item.description || '')
      .replace(/<[^>]*>/g, '').trim();
    if (rawContent.length < 50) continue;

    const slug = slugify(item.title || '');
    if (!slug) continue;

    const image = extractImage(item) || generateImage(item.title || '');
    let result = null;
    let usedRSS = false;

    try {
      console.log('  AI:', (item.title || '').slice(0, 60));
      result = await withTimeout(callGroq(item.title || '', rawContent), 15000);
      if (!result || !result.full_en || result.full_en.length < 50) throw new Error('Empty result');
      console.log('  ✅ Groq OK');
    } catch(e) {
      console.warn('  ❌ Groq:', e.message, '→ RSS fallback');
      result = rssFallback(item.title || '', rawContent);
      usedRSS = true;
    }

    return {
      slug,
      ...result,
      image_url: image,
      source_name: feed.name,
      used_rss: usedRSS,
      created_at: new Date().toISOString()
    };
  }
  return null;
}

async function main() {
  console.log('=== NEWS PARSER START ===');
  console.log('Groq:', GROQ_KEY ? '✅ key set' : '❌ missing');

  const articles = [];
  const seen = new Set();

  for (const feed of RSS_FEEDS_WEST) {
    if (articles.length >= 4) break;
    console.log('\nFeed:', feed.name);
    const art = await fetchArticle(feed);
    if (art && !seen.has(art.slug)) { seen.add(art.slug); articles.push(art); }
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n--- Asian source ---');
  for (const feed of RSS_FEEDS_ASIA) {
    if (articles.length >= 5) break;
    console.log('Feed:', feed.name);
    const art = await fetchArticle(feed);
    if (art && !seen.has(art.slug)) { seen.add(art.slug); articles.push(art); break; }
    await new Promise(r => setTimeout(r, 2000));
  }

  const summary = articles.map(a => (a.used_rss ? '(RSS)' : '(AI)') + ' ' + a.source_name).join(', ');
  console.log('\nResult:', articles.length, 'articles:', summary);
  fs.writeFileSync('news.json', JSON.stringify({ updated: new Date().toISOString(), articles }, null, 2));
  console.log('=== DONE ===');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
