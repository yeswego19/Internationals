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

// ВАЛИДАЦИЯ ПОЛНОТЫ ТЕКСТА
function validateArticle(result) {
  const errors = [];
  
  if (!result.full_en || result.full_en.length < 100) {
    errors.push('full_en too short (<100 chars)');
  }
  
  const sentences_en = result.full_en.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences_en.length < 5) {
    errors.push(`full_en has only ${sentences_en.length} sentences, expected 7`);
  }
  
  if (!result.full_ru || result.full_ru.length < 100) {
    errors.push('full_ru too short (<100 chars)');
  }
  
  const sentences_ru = result.full_ru.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences_ru.length < 5) {
    errors.push(`full_ru has only ${sentences_ru.length} sentences, expected 7`);
  }
  
  if (result.full_en.endsWith('...') || result.full_en.endsWith('…')) {
    errors.push('full_en ends with ellipsis');
  }
  
  if (result.full_ru.endsWith('...') || result.full_ru.endsWith('…')) {
    errors.push('full_ru ends with ellipsis');
  }
  
  return errors;
}

// РАСШИРЕНИЕ КОРОТКИХ ТЕКСТОВ
function expandArticle(result, title, content) {
  if (result.full_en.length < 150 || result.full_en.split(/[.!?]+/).filter(s => s.trim().length > 0).length < 5) {
    console.warn('  ⚠️ Expanding short full_en');
    
    let sentences = result.full_en.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (result.preview_en && result.preview_en.length > 20) {
      sentences.push(result.preview_en);
    }
    
    const facts = content.split(/[.!?]+/).filter(s => s.trim().length > 30).slice(0, 3);
    sentences.push(...facts);
    
    if (sentences.length < 5) {
      sentences.push(title);
    }
    
    result.full_en = sentences.slice(0, 7).map(s => s.trim() + '.').join(' ');
  }
  
  if (result.full_ru.length < 150 || result.full_ru.split(/[.!?]+/).filter(s => s.trim().length > 0).length < 5) {
    console.warn('  ⚠️ Expanding short full_ru');
    
    let sentences = result.full_ru.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (result.preview_ru && result.preview_ru.length > 20) {
      sentences.push(result.preview_ru);
    }
    
    const facts = content.split(/[.!?]+/).filter(s => s.trim().length > 30).slice(0, 3);
    sentences.push(...facts);
    
    if (sentences.length < 5) {
      sentences.push(title);
    }
    
    result.full_ru = sentences.slice(0, 7).map(s => s.trim() + '.').join(' ');
  }
  
  return result;
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
      
      // ВАЛИДАЦИЯ
      const errors = validateArticle(result);
      if (errors.length > 0) {
        console.warn('    ⚠️', p.name, 'Validation warnings:', errors.join(', '));
        
        // ПЫТАЕМСЯ РАСШИРИТЬ
        result = expandArticle(result, title, content);
        
        const newErrors = validateArticle(result);
        if (newErrors.length > 0) {
          console.warn('    ❌', p.name, 'Still invalid after expansion:', newErrors.join(', '));
          continue;
        }
      }
      
      console.log('    ✅', p.name, 'OK', `full_en: ${result.full_en.length} chars, ${result.full_en.split(/[.!?]+/).filter(s => s.trim().length > 0).length} sentences`);
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
        console.log('  ✅ Added article:', art.title_en, art.is_fallback ? '(RSS fallback)' : '(AI)');
        console.log(`     full_en: ${art.full_en.length} chars, ${art.full_en.split(/[.!?]+/).filter(s => s.trim().length > 0).length} sentences`);
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
        console.log(`     full_en: ${art.full_en.length} chars, ${art.full_en.split(/[.!?]+/).filter(s => s.trim().length > 0).length} sentences`);
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
