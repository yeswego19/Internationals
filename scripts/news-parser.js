const Parser = require('rss-parser');
const fs = require('fs');
const fetch = require('node-fetch');

const GROQ_KEY = process.env.GROQ_API_KEY;

const parser = new Parser({
  customFields: { item: [['media:content','mediaContent'],['media:thumbnail','mediaThumbnail']] }
});

const RSS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World', category: 'world' },
  { url: 'https://feeds.bbci.co.uk/sport/rss.xml', name: 'BBC Sport', category: 'sport' },
  { url: 'https://www.theguardian.com/artanddesign/rss', name: 'The Guardian Arts', category: 'arts' },
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch', category: 'tech' },
  { url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416', name: 'CNA Singapore', category: 'asia' }
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
    encodeURIComponent(title.slice(0, 80) + ', news photo, cinematic, realistic') +
    '?width=1024&height=576&nologo=true&seed=' + Math.floor(Math.random() * 99999);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// Очистка текста — убираем markdown, иероглифы, латиницу из русского
function cleanText(text, lang) {
  if (!text) return '';
  let result = text
    .replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '')
    .replace(/\s+/g, ' ').trim();
  if (lang === 'ru') {
    result = result.replace(/[^\u0400-\u04FF0-9\s.,!?:;()\-–—"'«»%№\n]/g, '').trim();
  }
  // Гарантируем заглавную букву в начале
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

const PROMPT = (title, content, category) => {
  const categoryHint = {
    sport: 'This is a SPORTS news story. Focus on the athletic achievement, competition, or sports development.',
    arts: 'This is an ARTS & CULTURE news story. Focus on the artistic, cultural, or creative aspects.',
    tech: 'This is a TECHNOLOGY news story. Focus on the innovation, impact, or technical development.',
    asia: 'This is a news story from ASIA. Focus on regional significance and global implications.',
    world: 'This is a WORLD news story. Focus on global significance and international impact.'
  }[category] || '';

  return `You are a sharp, professional news journalist. ${categoryHint}

CRITICAL RULES:
- Use THIRD PERSON ONLY. Never use "I", "my", "me", "we", "our".
- EVERY sentence must have an explicit subject (who/what is doing the action). Never start a sentence with a verb without naming who performs it.
- Every field MUST start with a capital letter and be a complete, grammatically correct sentence.
- Russian text: ONLY Cyrillic characters, digits, standard punctuation. NO Latin letters, NO Chinese characters, NO markdown (* or **).
- English text: ONLY Latin characters. NO markdown.
- preview_en and preview_ru must each be ONE complete sentence starting with a capital letter that clearly states WHO did WHAT.
- full_en and full_ru must each contain exactly 7 complete sentences, each starting with a capital letter and each having a clear subject.

Rewrite this news. Return ONLY valid JSON:
{
  "title_en": "Complete headline starting with capital letter, max 85 chars",
  "title_ru": "Полный заголовок с заглавной буквы, максимум 85 символов",
  "preview_en": "One complete sentence starting with capital letter, summarizing the story",
  "preview_ru": "Одно полное предложение с заглавной буквы, кратко описывающее суть новости",
  "full_en": "Exactly 7 complete sentences. Sentence 1 starts with capital letter and hooks the reader. Sentence 2: core facts. Sentence 3: context. Sentence 4: significance. Sentence 5: broader implication. Sentence 6: practical angle. Sentence 7: memorable closing.",
  "full_ru": "Ровно 7 полных предложений на русском. Первое начинается с заглавной буквы и захватывает внимание. Второе: суть и факты. Третье: контекст. Четвёртое: значимость. Пятое: более широкий взгляд. Шестое: практический аспект. Седьмое: запоминающаяся концовка.",
  "meta_en": "SEO description in English, max 155 chars",
  "meta_ru": "SEO описание на русском без латиницы, максимум 155 символов"
}

Title: ${title}
Content: ${content.slice(0, 800)}`;
};

async function callGroq(title, content, category) {
  if (!GROQ_KEY) throw new Error('No GROQ_API_KEY');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: PROMPT(title, content, category) }],
      temperature: 0.7,
      max_tokens: 1400,
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
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  return {
    title_en: cap(title.slice(0, 85)),
    title_ru: cap(title.slice(0, 85)),
    preview_en: cap(preview.slice(0, 200)),
    preview_ru: cap(preview.slice(0, 200)),
    full_en: cap(full || title),
    full_ru: cap(full || title),
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
      console.log('  AI [' + feed.category + ']:', (item.title || '').slice(0, 60));
      result = await withTimeout(callGroq(item.title || '', rawContent, feed.category), 15000);
      if (!result || !result.full_en || result.full_en.length < 50) throw new Error('Empty result');
      console.log('  ✅ OK');
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
      category: feed.category,
      used_rss: usedRSS,
      created_at: new Date().toISOString()
    };
  }
  return null;
}

async function main() {
  console.log('=== NEWS PARSER START ===');
  console.log('Groq:', GROQ_KEY ? '✅' : '❌ missing');

  const articles = [];
  const seen = new Set();

  for (const feed of RSS_FEEDS) {
    if (articles.length >= 5) break;
    console.log('\nFeed:', feed.name, '(' + feed.category + ')');
    const art = await fetchArticle(feed);
    if (art && !seen.has(art.slug)) {
      seen.add(art.slug);
      articles.push(art);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  const summary = articles.map(a => '[' + a.category + '] ' + (a.used_rss ? '(RSS)' : '(AI)') + ' ' + a.source_name).join(', ');
  console.log('\nResult:', articles.length, 'articles');
  console.log(summary);
  fs.writeFileSync('news.json', JSON.stringify({ updated: new Date().toISOString(), articles }, null, 2));
  console.log('=== DONE ===');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
