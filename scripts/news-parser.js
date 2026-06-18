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
Your response MUST be a single, valid, parsable JSON object and absolutely nothing else. No markdown, no triple backticks.
JSON structure:
{
  "title": "headline",
  "summary": "3 sentences summarizing the content",
  "meta_description": "seo description",
  "image_url": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800"
}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt}\n\nTitle: ${title}\nContent: ${content}` }] }] })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API HTTP Error! Status: ${response.status}. Details: ${errText}`);
  }

  const data = await response.json();
  
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error(`Gemini returned empty response structure! Raw data: ${JSON.stringify(data)}`);
  }

  let jsonText = data.candidates[0].content.parts[0].text.trim();
  jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();

  try {
    return JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`CRITICAL: Gemini returned invalid JSON string: "${jsonText}". Parse error: ${e.message}`);
  }
}

async function main() {
  console.log("=== STARTING NEWS PARSER ===");
  
  console.log("Cleaning up old articles from the database...");
  const { error: deleteError } = await supabase
    .from('articles')
    .delete()
    .neq('id', 0);
    
  if (deleteError) {
    throw new Error(`CRITICAL: Failed to clean database: ${deleteError.message}`);
  }
  console.log("Database is clean now!");

  for (const url of RSS_FEEDS) {
    console.log(`Parsing feed: ${url}`);
    const feed = await parser.parseURL(url);
    const items = feed.items.slice(0, 2); 
    
    for (const item of items) {
      const slug = slugify(item.title || '');
      if (!slug) continue;

      console.log(`Sending to Gemini: ${item.title}`);
      const aiResult = await adaptArticleWithAI(item.title, item.contentSnippet || item.content || '');
      
      const finalImageUrl = aiResult.image_url || '[https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800](https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800)';
      
      console.log(`Inserting into Supabase: ${aiResult.title}`);
      const { error: insertError } = await supabase.from('articles').insert([{
        slug: slug,
        title: aiResult.title,
        summary: aiResult.summary,
        meta_description: aiResult.meta_description,
        image_url: finalImageUrl
      }]);
      
      if (insertError) {
        throw new Error(`CRITICAL: Supabase INSERT failed: ${insertError.message}`);
      }
      
      console.log("-> Successfully inserted!");
      await new Promise(res => setTimeout(res, 2000));
    }
  }
  console.log("=== PARSING FINISHED SUCCESSFULLY ===");
}

main().catch(err => {
  console.error("❌ PROCESS FAILED:");
  console.error(err.message);
  console.error(err.stack);
  process.exit(1);
});
