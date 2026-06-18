const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const parser = new Parser();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
  console.error("Error: Missing environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY) in GitHub Secrets!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Your RSS news sources
const RSS_FEEDS = [
  'https://www.reutersagency.com/feed/', 
  'https://techcrunch.com/feed/'
];

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

async function adaptArticleWithAI(title, content) {
  const prompt = `You are a professional marketer in the field of relocation, immigration, and international documents. 
Your task is to adapt and summarize the following news article in English. 
Focus heavily on how this news might affect expats, immigrants, digital nomads, or international businesses.

Title: ${title}
Content: ${content}

Return the response STRICTLY as a JSON object (without markdown code blocks):
{
  "title": "Adapted catchy headline in English",
  "summary": "A concise summary of the news (3-4 sentences) focused on the impact on expats and relocation",
  "meta_description": "SEO description for the page (up to 160 characters)",
  "keywords": "comma, separated, keywords, relevant, to, expats"
}`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    const jsonText = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);
  } catch (error) {
    console.error(`AI adaptation failed for "${title}":`, error);
    return null;
  }
}

async function main() {
  console.log("Starting news parser...");
  
  for (const url of RSS_FEEDS) {
    try {
      console.log(`Parsing feed: ${url}`);
      const feed = await parser.parseURL(url);
      const items = feed.items.slice(0, 5); // Take top 5 recent items
      
      for (const item of items) {
        const slug = slugify(item.title);
        
        const { data: exists } = await supabase
          .from('articles')
          .select('id')
          .eq('slug', slug)
          .single();
          
        if (exists) {
          console.log(`Article already exists in DB: ${item.title}`);
          continue; 
        }
        
        console.log(`Processing new article: ${item.title}`);
        const aiResult = await adaptArticleWithAI(item.title, item.contentSnippet || item.content);
        
        if (aiResult) {
          const { error } = await supabase.from('articles').insert([{
            slug: slug,
            title: aiResult.title,
            summary: aiResult.summary,
            meta_description: aiResult.meta_description,
            keywords: aiResult.keywords,
            source_url: item.link
          }]);
          
          if (error) console.error("Supabase insert error:", error);
          else console.log(`Successfully added: ${aiResult.title}`);
        }
        
        await new Promise(res => setTimeout(res, 2000)); // 2-second cooldown
      }
    } catch (e) {
      console.error(`Error processing feed ${url}:`, e);
    }
  }
  console.log("Parsing finished.");
}

main();
