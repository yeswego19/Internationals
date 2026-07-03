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
  { url: 'https://thediplomat.com/feed/', name: 'The Diplomat' },
  { url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416', name: 'CNA Singapore' }
];

// Таймаут для fetch запросов
const FETCH_TIMEOUT = 30000; // 30 секунд

function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
    )
  ]);
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
    encodeURIComponent(title.slice(0, 80) + ', travel news photo, cinematic wide shot, realistic') +
    '?width=1024&height=576&nologo=true&seed=' + Math.floor(Math.random() * 99999);
}

// Безопасный парсинг JSON с извлечением из текста
function safeJSONParse(str) {
  if (!str) throw new Error('Empty response');
  
  // Удаляем markdown code blocks
  str = str.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  // Пытаемся найти JSON объект в тексте
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  
  if (start >= 0 && end > start) {
    str = str.slice(start, end + 1);
  }
  
  try {
    return JSON.parse(str);
  } catch(e) {
    throw new Error('Invalid JSON: ' + str.slice(0, 100));
  }
}

const PROMPT = (title, content) => `You are Alex — a sharp, witty 30-year-old translator, linguist and travel journalist who has lived in Berlin, Istanbul and Bangkok. You write smart, conversational prose with a touch of irony.

Rewrite this news in TWO languages. Return ONLY valid JSON (no markdown, no code blocks, no explanations):
{
  "title_en": "Punchy English headline, max 85 chars",
  "title_ru": "Цепляющий заголовок на русском, максимум 85 символов",
  "preview_en": "One-sentence hook in English, different wording from full text",
  "preview_ru": "Одно предложение-крючок на русском, отличается от начала полной статьи",
  "full_en": "Exactly 7 sentences in English: 1) hook; 2) facts; 3) context; 4) why it matters for expats/travelers; 5) personal angle; 6) practical tip; 7) witty closing.",
  "full_ru": "Ровно 7 предложений на русском: 1) завязка; 2) факты; 3) контекст; 4) важность для экспатов; 5) личный взгляд; 6) практический совет; 7) ироничная концовка.",
  "meta_en": "SEO description in English, max 155 chars",
  "meta_ru": "SEO описание на русском, максимум 155 символов"
}

Title: ${title}
Content: ${content.slice(0, 1000)}`;

async function callGrok(title, content) {
  if (!GROK_KEY) throw new Error('No GROK_API_KEY');
  
  const res = await fetchWithTimeout('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': 'Bearer ' + GROK_KEY 
    },
    body: JSON.stringify({
      model: 'grok-beta', // Используйте актуальную модель из вашего аккаунта
      messages: [{ role: 'user', content: PROMPT(title, content) }],
      temperature: 0.85,
      max_tokens: 1400
    })
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Grok HTTP ' + res.status + ': ' + err);
  }
  
  const data = await res.json();
  return safeJSONParse(data.choices[0].message.content);
}

async function callDeepSeek(title, content) {
  if (!DEEPSEEK_KEY) throw new Error('No DEEPSEEK_API_KEY');
  
  const res = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': 'Bearer ' + DEEPSEEK_KEY 
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: PROMPT(title, content) }],
      temperature: 0.85,
      max_tokens: 1400,
      response_format: { type: 'json_object' }
    })
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error('DeepSeek HTTP ' + res.status + ': ' + err);
  }
  
  const data = await res.json();
  return safeJSONParse(data.choices[0].message.content);
}

async function callGemini(title, content) {
  if (!GEMINI_KEY) throw new Error('No GEMINI_API_KEY');
  
  const res = await fetchWithTimeout(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'x-goog-api-key': GEMINI_KEY 
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT(title, content) }] }],
        generationConfig: { 
          temperature: 0.85,
          responseMimeType: 'application/json'
        }
      })
    }
  );
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Gemini HTTP ' + res.status + ': ' + err);
  }
  
  const data = await res.json();
  return safeJSONParse(data.candidates[0].content.parts[0].text);
}

async function callAI(title, content) {
  const providers = [
    { name: 'Grok', fn: callGrok },
    { name: 'DeepSeek', fn: callDeepSeek },
    { name: 'Gemini', fn: callGemini }
  ];
  
  for (const p of providers) {
    try {
      console.log('    trying', p.name);
      const result = await p.fn(title, content);
      
      // Проверяем структуру
      const required = ['title_en', 'title_ru', 'preview_en', 'preview_ru', 'full_en', 'full_ru', 'meta_en', 'meta_ru'];
      const valid = required.every(field => result[field] && result[field].length > 0);
      
      if (valid) {
        console.log('    ✅', p.name, 'OK');
        return result;
      } else {
        console.warn('    ❌', p.name, 'Invalid response structure');
      }
    } catch(e) {
      console.warn('    ❌', p.name, e.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

// Создание RSS-fallback статьи
function createRSSFallback(item, feed, rawContent, slug) {
  console.warn('  Using raw RSS fallback for:', item.title || 'Untitled');
  
  return {
    slug,
    title_en: item.title || 'Untitled',
    title_ru: item.title || 'Untitled',
    preview_en: rawContent.slice(0, 180) + (rawContent.length > 180 ? '...' : ''),
    preview_ru: rawContent.slice(0, 180) + (rawContent.length > 180 ? '...' : ''),
    full_en: rawContent,
    full_ru: rawContent,
    meta_en: (item.title || '').slice(0, 155),
    meta_ru: (item.title || '').slice(0, 155),
    image_url: extractImage(item) || generateImage(item.title || ''),
    source_name: feed.name,
    created_at: new Date().toISOString(),
    original_title: item.title || '',
    original_link: item.link || '',
    is_fallback: true // Маркер, что это RSS без AI
  };
}

async function fetchArticle(feed) {
  let feedData;
  try { 
    feedData = await parser.parseURL(feed.url); 
  } catch(e) { 
    console.warn('Skip:', feed.name, e.message); 
    return null; 
  }

  if (!feedData.items || feedData.items.length === 0) {
    console.warn('No items in feed:', feed.name);
    return null;
  }

  for (const item of feedData.items.slice(0, 5)) {
    const rawContent = (item.contentSnippet || item.content || item.description || '')
      .replace(/<[^>]*>/g, '').trim();
    
    if (rawContent.length < 50) {
      console.log('  Skipping: too short content');
      continue;
    }

    const slug = slugify(item.title || '');
    if (!slug) {
      console.log('  Skipping: no title');
      continue;
    }

    console.log('  Processing:', (item.title || '').slice(0, 60));
    
    // Пытаемся получить AI-версию
    const ai = await callAI(item.title || '', rawContent);

    // Если AI не сработал - используем RSS fallback
    if (!ai) {
      console.warn('  ❌ All AI providers failed, using RSS fallback');
      return createRSSFallback(item, feed, rawContent, slug);
    }

    // Возвращаем AI-версию
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
      image_url: extractImage(item) || generateImage(item.title || ''),
      source_name: feed.name,
      created_at: new Date().toISOString(),
      original_title: item.title || '',
      original_link: item.link || '',
      is_fallback: false
    };
  }
  return null;
}

async function main() {
  console.log('=== NEWS PARSER START ===');
  console.log('Keys available:', {
    grok: !!GROK_KEY,
    deepseek: !!DEEPSEEK_KEY,
    gemini: !!GEMINI_KEY
  });
  
  const articles = [];
  const seen = new Set();

  for (const feed of RSS_FEEDS_WEST) {
    if (articles.length >= 4) break;
    console.log('\nFeed:', feed.name);
    const art = await fetchArticle(feed);
    if (art) {
      // Проверяем уникальность по slug и ссылке
      const uniqueKey = art.original_link || art.slug;
      if (!seen.has(uniqueKey)) { 
        seen.add(uniqueKey);
        // Также добавляем slug для безопасности
        seen.add(art.slug);
        articles.push(art);
        console.log('  ✅ Added article:', art.title_en, art.is_fallback ? '(RSS fallback)' : '(AI)');
      } else {
        console.log('  ⏭️ Skipping duplicate:', art.title_en);
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n--- Asian source ---');
  for (const feed of RSS_FEEDS_ASIA) {
    if (articles.length >= 5) break;
    console.log('\nFeed:', feed.name);
    const art = await fetchArticle(feed);
    if (art) {
      const uniqueKey = art.original_link || art.slug;
      if (!seen.has(uniqueKey)) { 
        seen.add(uniqueKey);
        seen.add(art.slug);
        articles.push(art);
        console.log('  ✅ Added article:', art.title_en, art.is_fallback ? '(RSS fallback)' : '(AI)');
        break;
      } else {
        console.log('  ⏭️ Skipping duplicate:', art.title_en);
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (articles.length === 0) {
    console.warn('⚠️ No articles were fetched!');
    fs.writeFileSync('news.json', JSON.stringify({ 
      updated: new Date().toISOString(), 
      articles: [],
      error: 'No articles fetched'
    }, null, 2));
  } else {
    fs.writeFileSync('news.json', JSON.stringify({ 
      updated: new Date().toISOString(), 
      articles,
      stats: {
        total: articles.length,
        ai_generated: articles.filter(a => !a.is_fallback).length,
        rss_fallback: articles.filter(a => a.is_fallback).length
      }
    }, null, 2));
    console.log('\n✅ Saved', articles.length, 'articles to news.json');
    console.log('   AI:', articles.filter(a => !a.is_fallback).length);
    console.log('   RSS fallback:', articles.filter(a => a.is_fallback).length);
  }
  
  console.log('=== DONE ===');
}

main().catch(e => { 
  console.error('❌ FAILED:', e.message); 
  process.exit(1); 
});
