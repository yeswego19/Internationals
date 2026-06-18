const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const parser = new Parser();
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

async function adaptArticleWithAI(title, content) {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
  
  const prompt = `You are a professional marketer. Summarize this news article in English for expats. 
Your response MUST be a valid, parsable JSON object and NOTHING ELSE. Do not wrap it in \`\`\`json.
JSON format:
{
  "title": "headline",
  "summary": "3 sentences summarizing the content",
  "meta_description": "seo description",
  "image_url": "Provide a real, high-quality, direct Unsplash image URL that perfectly matches the topic. Use general Unsplash keywords if needed, for example: https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800 for cyber/hackers, https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800 for smartphones/tech, https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=800 for global politics/iran, or any valid clean Unsplash image source link matching the exact mood."
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
  
  console.log("Cleaning up old articles from the database...");
  const { error: deleteError } = await supabase
    .from('articles')
    .delete()
    .neq('id', 0);
    
  if (deleteError) {
    throw new Error(`Failed to clean database: ${deleteError.message}`);
  }
  console.log("Database is clean now!");

  for (const url of RSS_FEEDS) {
    console.log(`Parsing feed: ${url}`);
    let feed;
    try {
      feed = await parser.parseURL(url);
    } catch (e) {
      console.warn(`⚠️ Failed to parse RSS feed ${url}, skipping. Error:`, e.message);
      continue;
    }

    const items = feed.items.slice(0, 2); 
    
    for (const item of items) {
      const slug = slugify(item.title || '');
      if (!slug) continue;

      console.log(`Sending to Gemini: ${item.title}`);
      
      let aiResult;
      try {
        aiResult = await adaptArticleWithAI(item.title, item.contentSnippet || item.content || '');
      } catch (aiError) {
        console.warn(`⚠️ Skipping article due to Gemini error: ${aiError.message}`);
        continue;
      }
      
      if (aiResult) {
        // Берем прямую ссылку, которую сгенерировал ИИ. Если там пусто, страхуемся базовой картинкой.
        const finalImageUrl = aiResult.image_url || '[https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800](https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800)';
        
        console.log(`AI picked image URL: ${finalImageUrl}`);
        console.log(`Inserting into Supabase: ${aiResult.title}`);
        
        const { error: insertError } = await supabase.from('articles').insert([{
          slug: slug,
          title: aiResult.title,
          summary: aiResult.summary,
          meta_description: aiResult.meta_description,
          image_url: finalImageUrl
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
