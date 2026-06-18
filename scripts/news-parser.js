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
  const url = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent';
  const prompt = `You are a professional marketer. Summarize this news article in English for expats. Return STRICTLY a raw JSON object: {"title": "headline", "summary": "3 sentences", "meta_description": "seo"}\n\nTitle: ${title}\nContent: ${content}`;

  const response = await fetch(`${url}?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error! Status: ${response.status}. Details: ${errText}`);
  }

  const data = await response.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

async function main() {
  console.log("=== STARTING NEWS PARSER ===");
  
  for (const url of RSS_FEEDS) {
    console.log(`Parsing feed: ${url}`);
    const feed = await parser.parseURL(url);
    const items = feed.items.slice(0, 2); 
    
    for (const item of items) {
      const slug = slugify(item.title || '');
      if (!slug) continue;

      console.log(`Checking DB for slug: ${slug}`);
      const { data: exists, error: checkError } = await supabase
        .from('articles')
        .select('id')
        .eq('slug', slug);
        
      if (checkError) {
        throw new Error(`Supabase SELECT error: ${checkError.message}`);
      }
        
      if (exists && exists.length > 0) {
        console.log(`Article already exists: ${slug}`);
        continue; 
      }
      
      console.log(`Sending to Gemini: ${item.title}`);
      const aiResult = await adaptArticleWithAI(item.title, item.contentSnippet || item.content || '');
      
      if (aiResult) {
        console.log(`Inserting into Supabase: ${aiResult.title}`);
        
        // Вставляем строго те поля, которые есть на твоем скриншоте базы данных
        const { error: insertError } = await supabase.from('articles').insert([{
          slug: slug,
          title: aiResult.title,
          summary: aiResult.summary,
          meta_description: aiResult.meta_description
        }]);
        
        if (insertError) {
          throw new Error(`Supabase INSERT error: ${insertError.message}. Code: ${insertError.code}`);
        }
        console.log("-> Successfully inserted!");
      }
      await new Promise(res => setTimeout(res, 2000));
    }
  }
  console.log("=== PARSING FINISHED SUCCESSFULLY ===");
}

main().catch(err => {
  console.error("❌ CRITICAL PROCESS FAILURE:");
  console.error(err);
  process.exit(1);
});
