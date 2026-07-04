const Parser = require('rss-parser');
const fs = require('fs');
const fetch = require('node-fetch');

const GROK_KEY = process.env.GROK_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

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
  { url: 'https://www.scmp.com/rss/91/feed', name: 'South China Morning Post' },
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
    encodeURIComponent(title.slice(0, 80) + ', travel news photo, cinematic wide shot, realistic') +
    '?width=1024&height=576&nologo=true&seed=' + Math.floor(Math.random() * 99999);
}

// Таймаут 10 секунд на каждый AI запрос
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

const PROMPT = (title, content) => `You are Alex — a sharp, witty 30-year-old translator, linguist and travel journalist who has lived in Berlin, Istanbul and Bangkok. Write smart, conversational prose with a touch of irony.

Rewrite this news in TWO languages. Return ONLY valid JSON, nothing else:
{
  "title_en": "Punchy English headline, max 85 chars",
  "title_ru": "Цепляющий заголовок на русском, максимум 85 символов",
  "preview_en": "One-sentence hook in English",
  "preview_ru": "Одно предложение-крючок на русском",
  "full_en": "Exactly 7 sentences in English: 1) bold hook; 2) core facts; 3) context/background; 4) why it matters for expats or travelers; 5) personal angle or analysis; 6) practical tip; 7) witty closing.",
  "full_ru": "Ровно 7 предложений на русском: 1) яркая завязка; 2) суть и факты; 3) контекст; 4) важность для экспатов и путешественников; 5) личный взгляд; 6) практический совет; 7) ироничная концовка.",
  "meta_en": "SEO description in English, max 155 chars",
  "meta_ru": "SEO описание на русском, максимум 155 символов"
}

Title: ${title}
Content: ${content.slice(0, 1000)}`;

async function callGrok(title, content) {
  if (!GROK_KEY) throw new Error('No GROK_API_KEY');
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROK_KEY },
    body: JSON.stringify({
      model: 'grok-3-mini',
      messages: [{ role: 'user', content: PROMPT(title, content) }],
      temperature: 0.85,
      max_tokens: 1400,
      response_format: { type: 'json_object' }
    })
  });
  if (!res.ok) throw new Error('Grok HTTP ' + res.status);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content.trim());
}

async function callDeepSeek(title, content) {
  if (!DEEPSEEK_KEY) throw new Error('No DEEPSEEK_API_KEY');
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: PROMPT(title, content) }],
      temperature: 0.85,
      max_tokens: 1400,
      response_format: { type: 'json_object' }
    })
  });
  if (!res.ok) throw new Error('DeepSeek HTTP ' + res.status);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content.trim());
}

async function callGemini(title, content) {
  if (!GEMINI_KEY) throw new Error('No GEMINI_API_KEY');
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT(title, content) }] }],
      generationConfig: { temperature: 0.85, responseMimeType: 'application/json' }
    })
  });
  if (!res.ok) throw new Error('Gemini HTTP ' + res.status);
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text.trim());
}

// Простой RSS fallback — перефразируем без AI
function rssToArticle(title, content, feedName) {
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  const full_en = sentences.slice(0, 7).join('. ') + (sentences.length > 0 ? '.' : '');
  const full_ru = '(Без перевода — AI недоступен) ' + full_en;
  return {
    title_en: title.slice(0, 85),
    title_ru: title.slice(0, 85),
    preview_en: sentences[0] ? sentences[0] + '.' : title,
    preview_ru: sentences[0] ? sentences[0] + '.' : title,
    full_en: full_en || title,
    full_ru: full_ru || title,
    meta_en: title.slice(0, 155),
    meta_ru: title.slice(0, 155)
  };
}

async function callAI(title, content) {
  const providers = [
    { name: 'Grok', fn: callGrok },
    { name: 'DeepSeek', fn: callDeepSeek },
    { name: 'Gemini', fn: callGemini }
  ];

  for (const p of providers) {
    try {
      console.log('    trying', p.name, '...');
      const result = await withTimeout(p.fn(title, content), 10000);
      if (result && result.full_en && result.full_ru &&
          result.full_en.length > 100 && result.full_ru.length > 100) {
        console.log('    ✅', p.name, 'OK');
        return { ...result, aiProvider: p.name };
      }
      console.warn('    ⚠️', p.name, 'returned empty/short result');
    } catch(e) {
      console.warn('    ❌', p.name, e.message);
    }
  }
  return null; // все AI упали
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

    console.log('  Article:', (item.title || '').slice(0, 65));

    let aiResult = await callAI(item.title || '', rawContent);
    let usedRSS = false;

    if (!aiResult) {
      console.warn('  ⚠️ All AI failed — using RSS fallback');
      aiResult = rssToArticle(item.title || '', rawContent, feed.name);
      usedRSS = true;
    }

    const image = extractImage(item) || generateImage(item.title || '');

    return {
      slug,
      title_en: aiResult.title_en,
      title_ru: aiResult.title_ru,
      preview_en: aiResult.preview_en,
      preview_ru: aiResult.preview_ru,
      full_en: aiResult.full_en,
      full_ru: aiResult.full_ru,
      meta_en: aiResult.meta_en,
      meta_ru: aiResult.meta_ru,
      image_url: image,
      source_name: feed.name,
      used_rss_fallback: usedRSS,
      created_at: new Date().toISOString()
    };
  }
  return null;
}

async function main() {
  console.log('=== NEWS PARSER START ===');
  console.log('Grok:', GROK_KEY ? '✅ key set' : '❌ missing');
  console.log('DeepSeek:', DEEPSEEK_KEY ? '✅ key set' : '❌ missing');
  console.log('Gemini:', GEMINI_KEY ? '✅ key set' : '❌ missing');

  const articles = [];
  const seen = new Set();

  for (const feed of RSS_FEEDS_WEST) {
    if (articles.length >= 4) break;
    console.log('\nFeed:', feed.name);
    const art = await fetchArticle(feed);
    if (art && !seen.has(art.slug)) {
      seen.add(art.slug);
      articles.push(art);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n--- Asian source ---');
  for (const feed of RSS_FEEDS_ASIA) {
    if (articles.length >= 5) break;
    console.log('Feed:', feed.name);
    const art = await fetchArticle(feed);
    if (art && !seen.has(art.slug)) {
      seen.add(art.slug);
      articles.push(art);
      break;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  fs.writeFileSync('news.json', JSON.stringify({ updated: new Date().toISOString(), articles }, null, 2));
  console.log('\nSaved', articles.length, 'articles to news.json');
  console.log('AI stats:', articles.map(a => a.source_name + (a.used_rss_fallback ? '(RSS)' : '(AI)')).join(', '));
  console.log('=== DONE ===');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
