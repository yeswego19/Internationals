const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const parser = new Parser();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
  console.error("CRITICAL: Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const RSS_FEEDS = [
  'https://techcrunch.com/feed/',
  'https://www.reutersagency.com/feed/'
];

function slugify(text) {
  return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

async function adaptArticleWithAI(title, content) {
  const prompt = `You are a professional marketer in immigration. Summarize this news in English for expats. Return STRICTLY JSON: {"title": "headline", "summary": "3 sentences", "meta_description": "seo", "keywords": "keys"}\n\nTitle: ${title}\nContent: ${content}`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey
      },
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
    const jsonText = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);
  } catch (error) {
    console.error(`AI adaptation failed for "${title}":`, error.message);
    return null;
  }
}

async function main() {
  console.log("Starting news parser...");
  
  for (const url of RSS_FEEDS) {
    try {
      console.log(`Parsing feed: ${url}`);
      const feed = await parser.parseURL(url);
      const items = feed.items.slice(0, 3);
      
      for (const item of items) {
        const slug = slugify(item.title || '');
        if (!slug) continue;

        console.log(`Checking DB for slug: ${slug}`);
        const { data: exists, error: checkError } = await supabase
          .from('articles')
          .select('id')
          .eq('slug', slug);
          
        if (checkError) {
          console.error("CRITICAL: Supabase read error!", checkError.message);
          process.exit(1);
        }
          
        if (exists && exists.length > 0) {
          console.log(`Article already exists: ${slug}`);
          continue; 
        }
        
        console.log(`Sending to Gemini: ${item.title}`);
        const aiResult = await adaptArticleWithAI(item.title, item.contentSnippet || item.content);
        
        if (aiResult) {
          const { error: insertError } = await supabase.from('articles').insert([{
            slug: slug,
            title: aiResult.title,
            summary: aiResult.summary,
            meta_description: aiResult.meta_description,
            keywords: aiResult.keywords,
            source_url: item.link
          }]);
          
          if (insertError) {
            console.error("CRITICAL: Supabase insert error!", insertError.message);
            process.exit(1);
          } else {
            console.log(`Successfully added to DB: ${aiResult.title}`);
          }
        }
      }
    } catch (e) {
      console.error(`CRITICAL: Error processing feed ${url}:`, e.message);
      process.exit(1);
    }
  }
  console.log("Parsing finished successfully.");
}

main();
