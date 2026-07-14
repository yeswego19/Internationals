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

const RSS_FEEDS_SPORTS = [
  { url: 'https://rss.dw.com/rdf/rss-en-sports', name: 'DW Sports' }
];

const RSS_FEEDS_CULTURE = [
  { url: 'https://rss.dw.com/rdf/rss-en-cul', name: 'DW Culture' }
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadPreviousSlugs() {
  try {
    const prev = JSON.parse(fs.readFileSync('news.json', 'utf-8'));
    return new Set((prev.articles || []).map(a => a.slug));
  } catch (e) {
    return new Set();
  }
}

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
    '?width=768&height=768&nologo=true&seed=' + Math.floor(Math.random() * 99999);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout after ' + ms + 'ms')), ms))
  ]);
}

const PROMPT = (title, content) => `Rewrite this news story in a smart, third-person style — informative and factual, with light, dry humor where it fits naturally, but never overly serious or dry like a press release. Never write in first person, never invent a narrator or personal anecdotes — this is reporting, not a diary.

Rewrite this news in TWO languages. Return ONLY valid JSON:
{
  "title_en": "Punchy English headline, max 85 chars",
  "title_ru": "Цепляющий заголовок на русском, максимум 85 символов",
  "preview_en": "One-sentence hook in English",
  "preview_ru": "Одно предложение-крючок на русском",
  "full_en": "Exactly 7 sentences in English, third person throughout: 1) bold hook; 2) core facts; 3) context; 4) why it matters for expats/travelers; 5) a wry observation or wider implication; 6) practical tip; 7) witty closing.",
  "full_ru": "Ровно 7 предложений на русском, строго от третьего лица: 1) завязка; 2) факты; 3) контекст; 4) важно для экспатов; 5) ироничное наблюдение или более широкий взгляд на ситуацию; 6) практический совет; 7) остроумная концовка.",
  "meta_en": "SEO description in English, max 155 chars",
  "meta_ru": "SEO описание на русском, максимум 155 символов"
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
      temperature: 0.8,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Groq HTTP ' + res.status + ': ' + err.slice(0, 200));
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content.trim());
}

// RSS fallback — берём реальный текст, разбиваем на предложения
function rssFallback(title, content) {
  const sentences = content.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter(s => s.length > 20);
  const full = sentences.slice(0, 7).join(' ');
  const preview = sentences[0] || title;
  return {
    title_en: title.slice(0, 85),
    title_ru: title.slice(0, 85),
    preview_en: preview,
    preview_ru: preview,
    full_en: full || title,
    full_ru: full || title,
    meta_en: title.slice(0, 155),
    meta_ru: title.slice(0, 155)
  };
}

async function fetchArticle(feed, excludeSlugs) {
  let feedData;
  try { feedData = await parser.parseURL(feed.url); }
  catch(e) { console.warn('Skip feed:', feed.name, e.message); return null; }

  const pool = shuffle(feedData.items.slice(0, 8));

  for (const item of pool) {
    const rawContent = (item.contentSnippet || item.content || item.description || '')
      .replace(/<[^>]*>/g, '').trim();
    if (rawContent.length < 50) continue;

    const slug = slugify(item.title || '');
    if (!slug) continue;
    if (excludeSlugs && excludeSlugs.has(slug)) continue;

    const image = extractImage(item) || generateImage(item.title || '');
    let result = null;
    let usedRSS = false;

    try {
      console.log('  AI:', (item.title || '').slice(0, 60));
      result = await withTimeout(callGroq(item.title || '', rawContent), 15000);
      if (!result || !result.full_en || result.full_en.length < 100) throw new Error('Empty result');
      console.log('  ✅ Groq OK');
    } catch(e) {
      console.warn('  ❌ Groq failed:', e.message);
      console.log('  → Using RSS fallback');
      result = rssFallback(item.title || '', rawContent);
      usedRSS = true;
    }

    return {
      slug,
      title_en: result.title_en,
      title_ru: result.title_ru,
      preview_en: result.preview_en,
      preview_ru: result.preview_ru,
      full_en: result.full_en,
      full_ru: result.full_ru,
      meta_en: result.meta_en,
      meta_ru: result.meta_ru,
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
  const prevSlugs = loadPreviousSlugs(); // не повторяем темы из прошлого запуска

  console.log('\n--- World sources ---');
  for (const feed of shuffle(RSS_FEEDS_WEST)) {
    if (articles.length >= 4) break;
    console.log('Feed:', feed.name);
    const art = await fetchArticle(feed, new Set([...seen, ...prevSlugs]));
    if (art && !seen.has(art.slug)) { seen.add(art.slug); articles.push(art); }
    await new Promise(r => setTimeout(r, 2000)); // пауза между запросами к Groq
  }

  console.log('\n--- Asian source ---');
  for (const feed of shuffle(RSS_FEEDS_ASIA)) {
    if (articles.length >= 5) break;
    console.log('Feed:', feed.name);
    const art = await fetchArticle(feed, new Set([...seen, ...prevSlugs]));
    if (art && !seen.has(art.slug)) { seen.add(art.slug); articles.push(art); break; }
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n--- Sports ---');
  for (const feed of RSS_FEEDS_SPORTS) {
    console.log('Feed:', feed.name);
    const art = await fetchArticle(feed, new Set([...seen, ...prevSlugs]));
    if (art && !seen.has(art.slug)) { seen.add(art.slug); articles.push(art); break; }
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n--- Culture ---');
  for (const feed of RSS_FEEDS_CULTURE) {
    console.log('Feed:', feed.name);
    const art = await fetchArticle(feed, new Set([...seen, ...prevSlugs]));
    if (art && !seen.has(art.slug)) { seen.add(art.slug); articles.push(art); break; }
    await new Promise(r => setTimeout(r, 2000));
  }

  const summary = articles.map(a => (a.used_rss ? '(RSS)' : '(AI)') + ' ' + a.source_name).join(', ');
  console.log('\nResult:', articles.length, 'articles:', summary);

  fs.writeFileSync('news.json', JSON.stringify({ updated: new Date().toISOString(), articles }, null, 2));
  console.log('=== DONE ===');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
