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
  // Фиксированное соотношение сторон 16:9, чтобы не искажалось при object-fit:cover
  return 'https://image.pollinations.ai/prompt/' +
    encodeURIComponent(title.slice(0, 80) + ', travel news photo, cinematic wide shot, realistic, 16:9') +
    '?width=1024&height=576&nologo=true&seed=' + Math.floor(Math.random() * 99999);
}

async function callDeepSeek(title, content) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: `You are Alex — a sharp, witty 30-year-old translator, linguist and travel journalist who has lived in Berlin, Istanbul and Bangkok. You write smart, conversational prose with a touch of irony.

Rewrite this news article in TWO languages. The "full" version must be a completely rewritten, original article — NOT a copy of the source text. It must be exactly 7 sentences, fully self-contained (a reader should understand everything without needing to click anywhere else). Do NOT just repeat the preview sentence — the full version must add real depth, context, and detail beyond it.

Return ONLY valid JSON, nothing else:
{
  "title_en": "Punchy English headline with a hook, max 85 chars",
  "title_ru": "Цепляющий заголовок на русском, максимум 85 символов",
  "preview_en": "One single-sentence hook for the news list, different wording than the full text opening",
  "preview_ru": "Одно предложение-крючок для списка новостей на русском, формулировка отличается от начала полной статьи",
  "full_en": "Exactly 7 sentences in English: 1) hook; 2) what happened — facts; 3) background/context; 4) why it matters for expats/travelers; 5) a personal angle or analysis; 6) practical takeaway; 7) witty closing thought.",
  "full_ru": "Ровно 7 предложений на русском: 1) яркая завязка; 2) суть и факты; 3) контекст и предыстория; 4) почему важно для тех кто живёт или ездит за рубеж; 5) личный взгляд или анализ; 6) практический вывод; 7) запоминающаяся концовка с лёгкой иронией.",
  "meta_en": "SEO description in English, max 155 chars",
  "meta_ru": "SEO описание на русском, максимум 155 символов"
}

Original title: ${title}
Source content: ${content.slice(0, 1000)}`
      }],
      temperature: 0.85,
      max_tokens: 1400,
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

    // Пробуем AI до 2 раз; если оба раза не получилось — пропускаем статью целиком,
    // чтобы не публиковать "сырой" RSS-текст вместо нормальной статьи
    let ai = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log('  AI attempt', attempt + 1, ':', (item.title || '').slice(0, 50));
        const result = await callDeepSeek(item.title || '', rawContent);
        if (result && !result.quotaError && result.full_en && result.full_ru) {
          ai = result;
          break;
        }
        if (result && result.quotaError) {
          console.warn('  ⚠️ Quota exceeded');
          await new Promise(r => setTimeout(r, 3000));
        }
      } catch(e) {
        console.warn('  AI error:', e.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!ai) {
      console.warn('  ❌ Skipping article (AI failed):', (item.title || '').slice(0, 50));
      continue;
    }

    console.log('  ✅', ai.title_en.slice(0, 50));

    return {
      slug,
      title_en: ai.title_en,
      title_ru: ai.title_ru,
      preview_en: ai.preview_en,
      preview_ru: ai.preview_ru,
      full_en: ai.full_en,
      full_ru: ai.full_ru,
      meta_en: ai.meta_en,
      meta_ru: ai.meta_ru,
      image_url: image,
      source_name: feed.name,
      created_at: new Date().toISOString() // всегда сегодняшняя дата публикации
    };
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
