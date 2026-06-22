const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const parser = new Parser({
  customFields: {
    item: [['media:content', 'mediaContent'], ['media:thumbnail', 'mediaThumbnail'], ['enclosure', 'enclosure']]
  }
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
  throw new Error("CRITICAL: Missing environment variables!");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const RSS_FEEDS = [
  'https://techcrunch.com/feed/',
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://slator.com/feed/',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://feeds.npr.org/1001/rss.xml'
];

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 80);
}

// Извлекаем картинку из RSS-элемента
function extractImageFromItem(item) {
  // 1. media:content
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
    return item.mediaContent.$.url;
  }
  // 2. media:thumbnail
  if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
    return item.mediaThumbnail.$.url;
  }
  // 3. enclosure (для подкастов и новостей)
  if (item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.startsWith('image')) {
    return item.enclosure.url;
  }
  // 4. Ищем img тег в content
  const content = item['content:encoded'] || item.content || item.summary || '';
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];

  return null;
}

// Генерируем картинку через Pollinations.ai по заголовку (бесплатно, без ключа)
function generateImageUrl(title) {
  const prompt = encodeURIComponent(title.slice(0, 100) + ', news photo, realistic, high quality');
  return `https://image.pollinations.ai/prompt/${prompt}?width=800&height=450&nologo=true`;
}

async function adaptArticleWithAI(title, content) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

  // Тип 30-летнего путешественника — умного и весёлого
  const prompt = `You are Alex, a witty 30-year-old world traveler and expat who writes engaging news summaries. 
Write a summary of this news for expats, digital nomads, and international travelers.
Your response MUST be a single valid JSON object. No markdown, no backticks, nothing else.
JSON structure:
{
  "title": "catchy headline rewritten for expats (max 90 chars)",
  "summary": "5 sentences: explain what happened, why it matters for people living abroad or traveling, and end with a practical tip or observation. Keep it smart but human and slightly witty.",
  "meta_description": "SEO description max 155 chars"
}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}\n\nTitle: ${title}\nContent: ${content.slice(0, 1500)}` }] }],
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
    })
  });

  if (!response.ok) {
    if (response.status === 429) return { isQuotaError: true };
    const errText = await response.text();
    throw new Error(`Gemini API Error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  let jsonText = data.candidates[0].content.parts[0].text.trim();
  jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(jsonText);
}

async function main() {
  console.log("=== STARTING NEWS PARSER ===");

  // Удаляем старые статьи
  const { error: deleteError } = await supabase.from('articles').delete().neq('id', 0);
  if (deleteError) throw new Error(`Failed to clean database: ${deleteError.message}`);
  console.log("Database cleaned!");

  for (const feedUrl of RSS_FEEDS) {
    console.log(`\nParsing: ${feedUrl}`);
    let feed;
    try {
      feed = await parser.parseURL(feedUrl);
    } catch (e) {
      console.warn(`⚠️ Failed to parse ${feedUrl}: ${e.message}`);
      continue;
    }

    const items = feed.items.slice(0, 5); // 5 статей с каждого источника

    for (const item of items) {
      const slug = slugify(item.title || '');
      if (!slug) continue;

      // Проверяем дубликат
      const { data: existing } = await supabase.from('articles').select('id').eq('slug', slug).maybeSingle();
      if (existing) { console.log(`Skip duplicate: ${slug}`); continue; }

      console.log(`Processing: ${item.title}`);

      let finalTitle = item.title || 'Untitled';
      let finalSummary = (item.contentSnippet || item.content || item.summary || 'No description.').replace(/<[^>]*>/g, '').slice(0, 500);
      let finalMeta = finalTitle;

      // Картинка: сначала из RSS, потом Pollinations
      let finalImageUrl = extractImageFromItem(item);
      if (!finalImageUrl) {
        finalImageUrl = generateImageUrl(finalTitle);
        console.log(`  → No image in RSS, generating via Pollinations`);
      } else {
        console.log(`  → Image from RSS: ${finalImageUrl.slice(0, 60)}...`);
      }

      // AI обработка
      try {
        const aiResult = await adaptArticleWithAI(finalTitle, finalSummary);
        if (aiResult && aiResult.isQuotaError) {
          console.warn("⚠️ Gemini quota exceeded, using raw RSS data");
        } else if (aiResult && aiResult.title) {
          finalTitle = aiResult.title;
          finalSummary = aiResult.summary;
          finalMeta = aiResult.meta_description || finalMeta;
        }
      } catch (aiError) {
        console.warn(`⚠️ AI error: ${aiError.message}, using raw RSS`);
      }

      if (finalSummary.length > 600) finalSummary = finalSummary.slice(0, 597) + '...';

      const { error: insertError } = await supabase.from('articles').insert([{
        slug,
        title: finalTitle,
        summary: finalSummary,
        meta_description: finalMeta,
        image_url: finalImageUrl,
        source_url: item.link || '',
        source_name: feed.title || feedUrl,
        created_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
      }]);

      if (insertError) {
        console.error(`Insert error: ${insertError.message}`);
      } else {
        console.log(`✅ Inserted: ${finalTitle.slice(0, 60)}`);
      }

      await new Promise(res => setTimeout(res, 2500));
    }
  }
  console.log("\n=== PARSING FINISHED ===");
}

main().catch(err => {
  console.error("❌ FAILED:", err.message);
  process.exit(1);
});
