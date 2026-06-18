const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure']
    ]
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
  'https://feeds.bbci.co.uk/news/world/rss.xml'
];

function slugify(text) {
  return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

function getImageUrl(item) {
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
    return item.mediaContent.$.url;
  }
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }
  if (item.content) {
    const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch) return imgMatch[1];
  }
  return 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800';
}

async function adaptArticleWithAI(title, content) {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
  
  const prompt = `You are a professional marketer. Summarize this news article in English for expats. 
Your response MUST be a valid, parsable JSON object and NOTHING ELSE. Do not wrap it in \`\`\`json.
JSON format:
{
  "title": "headline",
  "summary": "3 sentences summarizing the content",
  "meta_description": "seo description"
}

Title: ${title}
Content: ${content}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error! Status: ${response.status}. Details: ${errText}`);
  }

  const data = await response.json();
  let jsonText = data.candidates[0].content.parts[0].text.trim();
  
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  }

  return JSON.parse(jsonText);
}

async function main() {
  console.log("=== STARTING NEWS PARSER ===");
  
  // КЛЮЧЕВОЙ МОМЕНТ: Перед началом работы удаляем ВСЕ старые новости из таблицы, чтобы не было мусора
  console.log("Cleaning up old articles from the database...");
  const { error: deleteError } = await supabase
    .from('articles')
    .delete()
    .neq('id', 0); // Этот трюк удаляет вообще все строки в Supabase
    
  if (deleteError) {
    throw new Error(`Failed to clean database: ${deleteError.message}`);
  }
  console.log("Database is clean now!");

  for (const url of RSS_FEEDS) {
    console.log(`Parsing feed: ${url}`);
    const feed = await parser.parseURL(url);
    const items = feed.items.slice(0, 2); // Берем по 2 самые свежие новости
    
    for (const item of items) {
      const slug = slugify(item.title || '');
      if (!slug) continue;
      
      const imageUrl = getImageUrl(item);
      console.log(`Found image URL: ${imageUrl}`);

      console.log(`Sending to Gemini: ${item.title}`);
      const aiResult = await adaptArticleWithAI(item.title, item.contentSnippet || item.content || '');
      
      if (aiResult) {
        console.log(`Inserting into Supabase: ${aiResult.title}`);
        
        const { error: insertError } = await supabase.from('articles').insert([{
          slug: slug,
          title: aiResult.title,
          summary: aiResult.summary,
          meta_description: aiResult.meta_description,
          image_url: imageUrl // Картинка летит в базу
        }]);
        
        if (insertError) {
          throw new Error(`Supabase INSERT error: ${insertError.message}`);
        }
        console.log("-> Successfully inserted!");
      }
      await new Promise(res => setTimeout(res, 2000));
    }
  }
  console.log("=== PARSING FINISHED SUCCESSFULLY ===");
}

main().catch(err => {
  console.error("❌ CRITICAL PROCESS FAILURE:", err);
  process.exit(1);
});
