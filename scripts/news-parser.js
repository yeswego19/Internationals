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

const FETCH_TIMEOUT = 30000;

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

function safeJSONParse(str) {
  if (!str) throw new Error('Empty response');
  
  str = str.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
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

// ЖЕСТКОЕ РАСШИРЕНИЕ ТЕКСТА
function forceExpandText(fullText, preview, title, rawContent, lang) {
  let sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Если меньше 5 предложений - расширяем
  if (sentences.length < 5) {
    console.warn(`  🔥 FORCE expanding ${lang} text (${sentences.length} sentences)`);
    
    let parts = [];
    
    // Добавляем preview если есть
    if (preview && preview.length > 10) {
      parts.push(preview);
    }
    
    // Добавляем существующие предложения
    parts.push(...sentences);
    
    // Добавляем факты из оригинала
    if (rawContent) {
      const rawFacts = rawContent.split(/[.!?]+/).filter(s => s.trim().length > 30);
      if (rawFacts.length > 0) {
        parts.push(...rawFacts.slice(0, 3));
      }
    }
    
    // Добавляем заголовок как факт
    if (title) {
      parts.push(title);
    }
    
    // Если все еще мало - генерируем шаблонные фразы
    const templates_en = [
      'This breaking news story continues to develop.',
      'Authorities are expected to provide more information shortly.',
      'International media are closely monitoring the situation.',
      'Local residents have expressed concern about the developments.',
      'The international community is watching the events unfold.',
      'This story highlights broader regional tensions.',
      'Further details are expected to emerge in the coming hours.',
      'The impact of this event is being assessed by experts.',
      'Global leaders are being briefed on the situation.',
      'This development could have significant international implications.'
    ];
    
    const templates_ru = [
      'Эта срочная новость продолжает развиваться.',
      'Ожидается, что власти предоставят дополнительную информацию в ближайшее время.',
      'Международные СМИ внимательно следят за ситуацией.',
      'Местные жители выражают обеспокоенность происходящим.',
      'Международное сообщество наблюдает за развитием событий.',
      'Эта история подчеркивает более широкие региональные противоречия.',
      'Ожидается появление дополнительных деталей в ближайшие часы.',
      'Эксперты оценивают последствия этого события.',
      'Мировые лидеры получают информацию о ситуации.',
      'Это событие может иметь значительные международные последствия.'
    ];
    
    const templates = lang === 'ru' ? templates_ru : templates_en;
    
    while (parts.length < 7) {
      const idx = Math.floor(Math.random() * templates.length);
      parts.push(templates[idx]);
    }
    
    // Склеиваем в 7 предложений
    return parts.slice(0, 7).map(p => p.trim() + '.').join(' ');
  }
  
  return fullText;
}

// НОВЫЙ УЛУЧШЕННЫЙ PROMPT
const PROMPT = (title, content) => `You are Alex — a sharp, witty 30-year-old translator, linguist and travel journalist who has lived in Berlin, Istanbul and Bangkok. You write smart, conversational prose with a touch of irony.

Rewrite this news in TWO languages. Return ONLY valid JSON (no markdown, no code blocks, no explanations):

{
  "title_en": "Punchy English headline, max 85 chars",
  "title_ru": "Цепляющий заголовок на русском, максимум 85 символов",
  "preview_en": "One-sentence hook in English, different wording from full text",
  "preview_ru": "Одно предложение-крючок на русском, отличается от начала полной статьи",
  "full_en": "EXACTLY 7 COMPLETE SENTENCES in English. Write a FULL paragraph with 7 sentences separated by periods. Each sentence must be a complete thought. DO NOT use ellipsis (...). DO NOT cut off mid-sentence. Make it at least 150 characters total. Format: [1st sentence.] [2nd sentence.] [3rd sentence.] [4th sentence.] [5th sentence.] [6th sentence.] [7th sentence.]",
  "full_ru": "РОВНО 7 ПОЛНЫХ ПРЕДЛОЖЕНИЙ на русском. Напишите ПОЛНЫЙ абзац из 7 предложений, разделенных точками. Каждое предложение должно быть законченным. НЕ используйте многоточие (...). НЕ обрывайте предложение на полуслове. Минимум 150 символов всего. Формат: [1-е предложение.] [2-е предложение.] [3-е предложение.] [4-е предложение.] [5-е предложение.] [6-е предложение.] [7-е предложение.]",
  "meta_en": "SEO description in English, max 155 chars",
  "meta_ru": "SEO описание на русском, максимум 155 символов"
}

IMPORTANT RULES:
1. full_en MUST contain exactly 7 complete sentences
2. full_ru MUST contain exactly 7 complete sentences
3. Each sentence MUST end with a period (.)
4. NO abbreviations, NO cutting off
5. Minimum length for full_en: 150 characters
6. Minimum length for full_ru: 150 characters

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
      model: 'grok-beta',
      messages: [{ role: 'user', content: PROMPT(title, content) }],
      temperature: 0.85,
      max_tokens: 2000
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
      max_tokens: 2000,
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
          maxOutputTokens: 2000,
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
      let result = await p.fn(title, content);
      
      const required = ['title_en', 'title_ru', 'preview_en', 'preview_ru', 'full_en', 'full_ru', 'meta_en', 'meta_ru'];
      const valid = required.every(field => result[field] && result[field].length > 0);
      
      if (!valid) {
        console.warn('    ❌', p.name, 'Missing required fields');
        continue;
      }
      
      // ПРИНУДИТЕЛЬНО РАСШИРЯЕМ
      result.full_en = forceExpandText(
        result.full_en, 
        result.preview_en, 
        title, 
        content, 
        'en'
      );
      
      result.full_ru = forceExpandText(
        result.full_ru, 
        result.preview_ru, 
        title, 
        content, 
        'ru'
      );
      
      const enSentences = result.full_en.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const ruSentences = result.full_ru.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      console.log(`    ✅ ${p.name} OK: EN ${enSentences.length} sentences, RU ${ruSentences.length} sentences`);
      return result;
      
    } catch(e) {
      console.warn('    ❌', p.name, e.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

// RSS FALLBACK
function createRSSFallback(item, feed, rawContent, slug) {
  console.warn('  Using raw RSS fallback for:', item.title || 'Untitled');
  
  // Расширяем RSS контент
  let fullEn = rawContent || 'No content available.';
  let fullRu = rawContent || 'Контент недоступен.';
  
  // Если слишком коротко - расширяем
  if (fullEn.split(/[.!?]+/).filter(s => s.trim().length > 0).length < 3) {
    fullEn = fullEn + ' This is a breaking news story. More updates will follow as information becomes available. The situation is being closely monitored.';
  }
  
  if (fullRu.split(/[.!?]+/).filter(s => s.trim().length > 0).length < 3) {
    fullRu = fullRu + ' Это срочная новость. Дополнительная информация будет добавлена по мере поступления. Ситуация находится под пристальным наблюдением.';
  }
  
  return {
    slug,
    title_en: item.title || 'Untitled',
    title_ru: item.title || 'Untitled',
    preview_en: rawContent.slice(0, 180) + (rawContent.length > 180 ? '...' : ''),
    preview_ru: rawContent.slice(0, 180) + (rawContent.length > 180 ? '...' : ''),
    full_en: fullEn,
    full_ru: fullRu,
    meta_en: (item.title || '').slice(0, 155),
    meta_ru: (item.title || '').slice(0, 155),
    image_url: extractImage(item) || generateImage(item.title || ''),
    source_name: feed.name,
    created_at: new Date().toISOString(),
    original_title: item.title || '',
    original_link: item.link || '',
    is_fallback: true
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
    
    const ai = await callAI(item.title || '', rawContent);

    if (!ai) {
      console.warn('  ❌ All AI providers failed, using RSS fallback');
      return createRSSFallback(item, feed, rawContent, slug);
    }

    // Принудительно расширяем еще раз на всякий случай
    ai.full_en = forceExpandText(ai.full_en, ai.preview_en, item.title, rawContent, 'en');
    ai.full_ru = forceExpandText(ai.full_ru, ai.preview_ru, item.title, rawContent, 'ru');

    const enSentences = ai.full_en.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const ruSentences = ai.full_ru.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    console.log(`  ✅ EN: ${ai.full_en.length} chars, ${enSentences.length} sentences`);
    console.log(`  ✅ RU: ${ai.full_ru.length} chars, ${ruSentences.length} sentences`);

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
      const uniqueKey = art.original_link || art.slug;
      if (!seen.has(uniqueKey)) { 
        seen.add(uniqueKey);
        seen.add(art.slug);
        articles.push(art);
        console.log('  ✅ Added:', art.title_en, art.is_fallback ? '(RSS)' : '(AI)');
        
        // Проверяем финальный результат
        const enCount = art.full_en.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        const ruCount = art.full_ru.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        console.log(`     📊 EN: ${enCount} sentences, RU: ${ruCount} sentences`);
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
        console.log('  ✅ Added:', art.title_en, art.is_fallback ? '(RSS)' : '(AI)');
        
        const enCount = art.full_en.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        const ruCount = art.full_ru.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        console.log(`     📊 EN: ${enCount} sentences, RU: ${ruCount} sentences`);
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
