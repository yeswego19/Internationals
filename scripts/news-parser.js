const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const parser = new Parser();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
  console.error("Ошибка: Не все переменные окружения (SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY) заданы в GitHub Secrets!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Твои источники новостей
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
  const prompt = `Ты профессиональный маркетолог в сфере релокации и международных документов. 
Твоя задача — перевести, адаптировать и пересказать следующую новость на русском языке. 
Сделай фокус на том, как это может повлиять на экспатов, иммигрантов или международный бизнес.

Заголовок: ${title}
Текст: ${content}

Верни ответ СТРОГО в формате JSON-объекта (без разметки markdown):
{
  "title": "Адаптированный заголовок на русском",
  "summary": "Короткий пересказ/суть новости в 3-4 предложениях с точки зрения релокации",
  "meta_description": "SEO-описание для страницы (до 160 символов)",
  "keywords": "ключевые, слова, через, запятую"
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
    console.error(`Ошибка AI-адаптации для "${title}":`, error);
    return null;
  }
}

async function main() {
  console.log("Запуск парсера новостей...");
  
  for (const url of RSS_FEEDS) {
    try {
      console.log(`Парсим фид: ${url}`);
      const feed = await parser.parseURL(url);
      const items = feed.items.slice(0, 5); // Берем последние 5 новостей
      
      for (const item of items) {
        const slug = slugify(item.title);
        
        const { data: exists } = await supabase
          .from('articles')
          .select('id')
          .eq('slug', slug)
          .single();
          
        if (exists) {
          console.log(`Новость уже есть в базе: ${item.title}`);
          continue; 
        }
        
        console.log(`Обрабатываем новую новость: ${item.title}`);
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
          
          if (error) console.error("Ошибка вставки в Supabase:", error);
          else console.log(`Успешно добавлено: ${aiResult.title}`);
        }
        
        await new Promise(res => setTimeout(res, 2000)); // Пауза 2 секунды
      }
    } catch (e) {
      console.error(`Ошибка обработки фида ${url}:`, e);
    }
  }
  console.log("Парсинг завершен.");
}

main();
