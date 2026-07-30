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

// Очищаем текст от markdown, иероглифов и случайной латиницы в русском тексте
function cleanText(text, lang) {
  if (!text) return '';
  let result = text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (lang === 'ru') {
    // Убираем всё что не кириллица, цифры, базовая пунктуация
    result = result.replace(/[^\u0400-\u04FF0-9\s.,!?:;()\-–—"'«»%№\n]/g, '');
  }
  return result.trim();
}

const PROMPT = (title, content) => `You are a sharp, witty journalist. Write smart, conversational prose.

CRITICAL RULES:
- Use THIRD PERSON ONLY throughout. Never use "I", "my", "me", "we", "our" in any language.
- Russian text: ONLY Cyrillic characters, digits, and standard punctuation. NO Latin letters, NO Chinese/Japanese/Korean characters, NO markdown like ** or *.
- English text: ONLY Latin characters and standard punctuation. NO markdown.
- Do NOT use the words "expat", "expats", "traveler", "travelers" anywhere.
- Do NOT mention "I can confirm", "as someone who", or any first-person perspective.

Rewrite this news. Return ONLY valid JSON:
{
  "title_en": "Punchy English headline, max 85 chars, no markdown",
  "title_ru": "Заголовок ТОЛЬКО на русском языке, без латиницы, максимум 85 символов",
  "preview_en": "One sentence hook in English only, third person",
  "preview_ru": "Одно предложение только на русском языке без латинских букв, от третьего лица",
  "full_en": "Exactly 7 sentences in English, third person throughout: 1) bold hook; 2) core facts; 3) context; 4) broader significance; 5) a wry observation or wider implication; 6) practical tip; 7) witty closing. Do not use the words expat, expats, or traveler(s) anywhere.",
  "full_ru": "Ровно 7 предложений ТОЛЬКО на русском языке, строго от третьего лица, без латинских букв и иероглифов: 1) завязка; 2) факты; 3) контекст; 4) более широкая значимость; 5) ироничное наблюдение; 6) практический совет; 7) остроумная концовка. Не используй слова экспат, экспаты, путешественник(и) нигде в тексте.",
  "meta_en": "SEO description in English, max 155 chars",
  "meta_ru": "SEO описание только на русском без латиницы, максимум 155 символов"
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
  return {
    title_en: cleanText(parsed.title_en || '', 'en'),
    title_ru: cleanText(parsed.title_ru || '', 'ru'),
    preview_en: cleanText(parsed.preview_en || '', 'en'),
    preview_ru: cleanText(parsed.preview_ru || '', 'ru'),
    full_en: cleanText(parsed.full_en || '', 'en'),
    full_ru: cleanText(parsed.full_ru || '', 'ru'),
    meta_en: cleanText(parsed.meta_en || '', 'en'),
    meta_ru: cleanText(parsed.meta_ru || '', 'ru')
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
