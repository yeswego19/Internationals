const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/articles') return handleArticles(env);
    if (path === '/article') return handleArticle(url.searchParams.get('slug'), env);
    if (path === '/translate' && request.method === 'POST') return handleTranslate(request, env);
    if (path === '/feedback') return handleFeedback(env);
    if (path === '/rss') return handleRSS();
    return new Response('Not found', { status: 404 });
  }
};

async function handleArticles(env) {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/articles?select=id,title,summary,seo_slug,created_at,image_url,category,country,source_name&is_published=eq.true&order=created_at.desc&limit=60`, { headers: { 'apikey': env.SUPABASE_KEY, 'Authorization': `Bearer ${env.SUPABASE_KEY}` } });
    return json(await res.json());
  } catch (e) { return json({ error: e.message }, 500); }
}

async function handleArticle(slug, env) {
  if (!slug) return json({ error: 'No slug' }, 400);
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/articles?seo_slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&limit=1`, { headers: { 'apikey': env.SUPABASE_KEY, 'Authorization': `Bearer ${env.SUPABASE_KEY}` } });
    const data = await res.json();
    return json(data[0] || null);
  } catch (e) { return json({ error: e.message }, 500); }
}

async function handleFeedback(env) {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/feedback?select=*&order=created_at.desc&limit=50`, { headers: { 'apikey': env.SUPABASE_KEY, 'Authorization': `Bearer ${env.SUPABASE_KEY}` } });
    return json(await res.json());
  } catch (e) { return json({ error: e.message }, 500); }
}

async function handleTranslate(request, env) {
  try {
    const { text, targetLang } = await request.json();
    if (!text || !targetLang) return json({ error: 'No text or targetLang' }, 400);
    if (targetLang === 'en') return json({ translated: text });
    const langNames = { ru:'Russian', de:'German', es:'Spanish', pt:'Portuguese', zh:'Chinese (Simplified)', ar:'Arabic', fr:'French', it:'Italian', ja:'Japanese', ko:'Korean', tr:'Turkish', id:'Indonesian', hi:'Hindi', nl:'Dutch', pl:'Polish' };
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: `Translate to ${langNames[targetLang] || targetLang}. Return ONLY translated text:\n\n${text}` }] }], generationConfig: { temperature: 0.2 } }) });
    const data = await res.json();
    return json({ translated: data?.candidates?.[0]?.content?.parts?.[0]?.text || text });
  } catch (e) { return json({ error: e.message }, 500); }
}

async function handleRSS() {
  const feeds = ['https://feeds.bbci.co.uk/news/world/rss.xml', 'https://www.aljazeera.com/xml/rss/all.xml', 'https://slator.com/feed/'];
  let articles = [];
  for (const feedUrl of feeds) {
    try {
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=10`);
      const data = await res.json();
      if (data.items) articles = articles.concat(data.items.map(item => ({ title: item.title, summary: (item.description || '').replace(/<[^>]*>/g, '').slice(0, 500), source_name: data.feed?.title || 'RSS', source_url: item.link, image_url: item.thumbnail || null, created_at: item.pubDate, seo_slug: null, category: 'news' })));
      if (articles.length >= 20) break;
    } catch (e) {}
  }
  articles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return json(articles.slice(0, 20));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
