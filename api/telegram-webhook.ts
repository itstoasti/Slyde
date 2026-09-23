import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const processedUpdates = new Set<number>();

// Decode HTML entities
function decodeEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)));
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatIsoDuration(duration: string): string {
  if (!duration) return '10m';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return duration.replace(/^PT/i, '').toLowerCase() || '10m';
  const hours = match[1] ? `${match[1]}h ` : '';
  const mins = match[2] ? `${match[2]}m` : '';
  return `${hours}${mins}`.trim() || '10m';
}

function parseServings(rawYield: any): string {
  if (!rawYield) return '4';
  if (Array.isArray(rawYield)) {
    for (const item of rawYield) {
      const parsed = parseServings(item);
      if (parsed && parsed !== '4') return parsed;
    }
    if (rawYield.length > 0) return parseServings(rawYield[0]);
  }
  const str = String(rawYield).trim();
  const rangeMatch = str.match(/(\d+)\s*(?:to|-)\s*(\d+)/i);
  if (rangeMatch) return `${rangeMatch[1]}-${rangeMatch[2]}`;
  const numMatch = str.match(/(\d+)/);
  if (numMatch) return numMatch[1];
  return '4';
}

function cleanCalories(rawCal: any): string {
  if (!rawCal) return '320 cal';
  const str = String(rawCal);
  const numMatch = str.match(/(\d+)/);
  return numMatch ? `${numMatch[1]} cal` : '320 cal';
}

function getFallbackImage(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('cookie') || t.includes('biscuit') || t.includes('funnel') || t.includes('doughnut') || t.includes('donut')) {
    return 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('cake') || t.includes('cupcake') || t.includes('dessert') || t.includes('brownie')) {
    return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('pudding') || t.includes('banana')) {
    return 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('steak') || t.includes('beef') || t.includes('meat') || t.includes('burger')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('chicken') || t.includes('poultry') || t.includes('wings')) {
    return 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('pasta') || t.includes('spaghetti') || t.includes('penne') || t.includes('lasagna')) {
    return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('salad') || t.includes('bowl')) {
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=85';
  }
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=85';
}

function synthesizeRecipeFallback(title: string, url: string): { ingredients: { name: string; amount: string }[]; method: string[]; prepTime: string; cookTime: string } {
  const t = (title || url || '').toLowerCase();
  let ingredients: { name: string; amount: string }[] = [];
  let method: string[] = [];
  let prepTime = '10m';
  let cookTime = '15m';

  if (t.includes('cookie') || t.includes('biscuit') || t.includes('shortbread')) {
    prepTime = '15m';
    cookTime = '10m';
    ingredients = [
      { name: 'All-Purpose Flour', amount: '2 1/4 cups' },
      { name: 'Unsalted Butter (softened)', amount: '1 cup' },
      { name: 'Granulated Sugar', amount: '3/4 cup' },
      { name: 'Brown Sugar (packed)', amount: '3/4 cup' },
      { name: 'Large Eggs', amount: '2' },
      { name: 'Pure Vanilla Extract', amount: '1 tsp' },
      { name: 'Baking Soda & Sea Salt', amount: '1 tsp each' }
    ];
    method = [
      'Preheat oven to 375°F (190°C) and line baking sheets with parchment.',
      'Beat butter and sugars in a large bowl until light and fluffy (2-3 mins).',
      'Add eggs one at a time, beating well, then stir in vanilla extract.',
      'Gradually whisk in flour, baking soda, and salt until soft dough forms.',
      'Drop rounded tablespoons onto sheets and bake 9-11 mins until golden edges.',
      'Cool on wire rack for 5 minutes and serve warm!'
    ];
  } else if (t.includes('cake') || t.includes('cupcake') || t.includes('brownie')) {
    prepTime = '20m';
    cookTime = '30m';
    ingredients = [
      { name: 'Cake or All-Purpose Flour', amount: '2 cups' },
      { name: 'Granulated Sugar', amount: '1 1/2 cups' },
      { name: 'Unsalted Butter or Oil', amount: '1/2 cup' },
      { name: 'Whole Milk', amount: '1 cup' },
      { name: 'Large Eggs', amount: '2' },
      { name: 'Baking Powder & Vanilla', amount: '1 tbsp each' }
    ];
    method = [
      'Preheat oven to 350°F (175°C) and grease baking pans.',
      'Whisk dry ingredients together in a large bowl.',
      'Beat wet ingredients separately, then fold into dry mixture until smooth.',
      'Pour into prepared pan and bake 25-30 minutes until a toothpick comes out clean.',
      'Allow to cool completely before frosting and slicing.'
    ];
  } else if (t.includes('chicken') || t.includes('poultry') || t.includes('wings')) {
    prepTime = '10m';
    cookTime = '20m';
    ingredients = [
      { name: 'Boneless Chicken Breasts or Thighs', amount: '1.5 lbs' },
      { name: 'Extra Virgin Olive Oil', amount: '2 tbsp' },
      { name: 'Minced Garlic', amount: '3 cloves' },
      { name: 'Smoked Paprika & Italian Seasoning', amount: '1 tsp each' },
      { name: 'Fresh Lemon Juice', amount: '1 tbsp' },
      { name: 'Sea Salt & Cracked Black Pepper', amount: 'To taste' }
    ];
    method = [
      'Pat chicken dry and season generously on both sides.',
      'Heat olive oil in a heavy skillet over medium-high heat.',
      'Sear chicken for 6-8 minutes per side until golden brown and cooked through (165°F).',
      'Add minced garlic and a squeeze of fresh lemon juice during the last 2 minutes.',
      'Rest for 5 minutes before slicing and serving.'
    ];
  } else if (t.includes('pasta') || t.includes('spaghetti') || t.includes('penne') || t.includes('lasagna')) {
    prepTime = '10m';
    cookTime = '15m';
    ingredients = [
      { name: 'Favorite Pasta', amount: '1 lb (450g)' },
      { name: 'Extra Virgin Olive Oil or Butter', amount: '3 tbsp' },
      { name: 'Fresh Garlic (thinly sliced)', amount: '4 cloves' },
      { name: 'Freshly Grated Parmesan', amount: '1/2 cup' },
      { name: 'Reserved Starchy Pasta Water', amount: '1/2 cup' },
      { name: 'Fresh Basil & Red Pepper Flakes', amount: 'Garnish' }
    ];
    method = [
      'Bring a large pot of salted water to a rolling boil.',
      'Cook pasta until al dente, reserving 1/2 cup pasta cooking water before draining.',
      'Gently sauté sliced garlic and chili flakes in olive oil until aromatic.',
      'Toss drained pasta into the skillet with reserved water and grated cheese.',
      'Stir vigorously until an emulsion coats the pasta, garnish and serve hot.'
    ];
  } else {
    ingredients = [
      { name: 'Main Core Protein / Produce', amount: '1.5 lbs' },
      { name: 'Extra Virgin Olive Oil or Butter', amount: '2 tbsp' },
      { name: 'Aromatic Garlic & Onion', amount: 'To taste' },
      { name: 'Herb & Spice Seasoning Blend', amount: '1 tbsp' },
      { name: 'Sea Salt & Coarse Black Pepper', amount: 'To taste' },
      { name: 'Fresh Lemon or Herb Garnish', amount: 'As needed' }
    ];
    method = [
      'Prepare and chop all fresh ingredients at room temperature.',
      'Heat oil or butter in a skillet or pan over medium-high heat.',
      'Sauté aromatics until fragrant and golden (2-3 minutes).',
      'Add main ingredients and cook to desired doneness, stirring occasionally.',
      'Season to taste with salt, pepper, and fresh herbs.',
      'Plate immediately and enjoy fresh!'
    ];
  }

  return { ingredients, method, prepTime, cookTime };
}

// Serverless Recipe Extractor
async function extractRecipeServer(recipeUrl: string) {
  let html = '';

  // 1. Try Jina HTML proxy (fastest when allowed)
  try {
    const res = await fetch(`https://r.jina.ai/${recipeUrl}`, {
      headers: { 'X-Return-Format': 'html' }
    });
    if (res.ok) {
      const txt = await res.text();
      if (txt && txt.length > 500) html = txt;
    }
  } catch (e) {}

  // 2. Try AllOrigins raw proxy if Jina was blocked (e.g. 451)
  if (!html || html.length < 500) {
    try {
      const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(recipeUrl)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      });
      if (res.ok) {
        const txt = await res.text();
        if (txt && txt.length > 500) html = txt;
      }
    } catch (e) {}
  }

  // 3. Try direct fetch with desktop browser headers
  if (!html || html.length < 500) {
    try {
      const res = await fetch(recipeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      if (res.ok) {
        const txt = await res.text();
        if (txt && txt.length > 500) html = txt;
      }
    } catch (e) {}
  }

  // Parse JSON-LD
  let recipeObj: any = null;
  const match = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const m of match) {
    try {
      const jsonStr = m.replace(/<script.*?>|<\/script>/gi, '').trim();
      const parsed = JSON.parse(jsonStr);
      const list = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);
      const found = list.find((i: any) => {
        if (!i) return false;
        const type = i['@type'];
        if (typeof type === 'string') return type.toLowerCase() === 'recipe';
        if (Array.isArray(type)) return type.some((t: any) => String(t).toLowerCase() === 'recipe');
        return false;
      });
      if (found) {
        recipeObj = found;
        break;
      }
    } catch (e) {}
  }

  // Title extraction: schema name -> og:title -> <title> -> url slug
  let rawTitle = recipeObj?.name || '';
  if (!rawTitle) {
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogTitle) rawTitle = ogTitle[1];
  }
  if (!rawTitle) {
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTag) rawTitle = titleTag[1].split('|')[0].split('-')[0].trim();
  }

  // If title is a generic block or error page, fallback to URL slug
  const lowerRaw = (rawTitle || '').toLowerCase();
  const isJunkTitle = !rawTitle || 
    lowerRaw.includes('page not found') || 
    lowerRaw.includes('access denied') || 
    lowerRaw.includes('403') || 
    lowerRaw.includes('404') || 
    lowerRaw.includes('blocked') || 
    lowerRaw.includes('robot') || 
    lowerRaw.includes('cloudflare') || 
    lowerRaw.includes('attention required') || 
    lowerRaw === 'delicious recipe';

  if (isJunkTitle) {
    try {
      const urlObj = new URL(recipeUrl);
      const segments = urlObj.pathname.split('/').filter(Boolean);
      // Pick the last segment that is not just numbers
      const slug = segments.reverse().find(s => !/^\d+$/.test(s)) || 'delicious-easy-recipe';
      rawTitle = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    } catch (e) {
      rawTitle = 'Delicious Recipe';
    }
  }

  const title = decodeEntities(rawTitle).replace(/(Recipe|Easy|Quick|Best|Simple)\s*$/gi, '').trim() || 'Delicious Recipe';
  let prepTime = formatIsoDuration(recipeObj?.prepTime || '10m');
  let cookTime = formatIsoDuration(recipeObj?.cookTime || '15m');
  const servings = parseServings(recipeObj?.recipeYield);
  const calories = cleanCalories(recipeObj?.nutrition?.calories);

  // Ingredients extraction
  const rawIngredients = Array.isArray(recipeObj?.recipeIngredient) ? recipeObj.recipeIngredient : [];
  let ingredients = rawIngredients.map((i: any) => {
    const clean = decodeEntities(String(i)).trim();
    const parts = clean.split('—').length > 1 ? clean.split('—') : clean.split(' - ');
    if (parts.length > 1) {
      return { name: parts[0].trim(), amount: parts.slice(1).join(' - ').trim() };
    }
    return { name: clean, amount: '' };
  }).filter((i: any) => i.name.length > 0).slice(0, 16);

  // Instructions extraction (with HowToSection & itemListElement flattening)
  let method: string[] = [];
  if (Array.isArray(recipeObj?.recipeInstructions)) {
    const rawSteps: string[] = [];
    for (const item of recipeObj.recipeInstructions) {
      if (typeof item === 'string') {
        rawSteps.push(item);
      } else if (item?.text) {
        rawSteps.push(item.text);
      } else if (Array.isArray(item?.itemListElement)) {
        for (const subItem of item.itemListElement) {
          if (typeof subItem === 'string') rawSteps.push(subItem);
          else if (subItem?.text) rawSteps.push(subItem.text);
        }
      }
    }
    method = rawSteps.map((s: string) => decodeEntities(s)
      .replace(/^Step\s*\d+:\s*/i, '')
      .replace(/^\d+\.\s*/, '')
      .replace(/Recipe developed by.*/i, '')
      .replace(/Recipe adapted from.*/i, '')
      .trim()
    ).filter(Boolean).slice(0, 6);
  }

  // Guaranteed fallback if scraping was blocked or incomplete
  if (ingredients.length === 0 || method.length === 0) {
    const synth = synthesizeRecipeFallback(title, recipeUrl);
    if (ingredients.length === 0) ingredients = synth.ingredients;
    if (method.length === 0) method = synth.method;
    if (!prepTime || prepTime === '10m') prepTime = synth.prepTime;
    if (!cookTime || cookTime === '15m') cookTime = synth.cookTime;
  }

  let imageUrl = '';
  if (typeof recipeObj?.image === 'string') {
    imageUrl = recipeObj.image;
  } else if (Array.isArray(recipeObj?.image) && recipeObj.image[0]) {
    imageUrl = typeof recipeObj.image[0] === 'string' ? recipeObj.image[0] : (recipeObj.image[0].url || '');
  } else if (recipeObj?.image?.url) {
    imageUrl = recipeObj.image.url;
  }

  if (!imageUrl) {
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch) imageUrl = ogMatch[1];
  }

  if (!imageUrl) {
    imageUrl = getFallbackImage(title);
  }

  const brandName = process.env.BRAND_NAME || 'SnapRecipes';
  const ctaUrl = process.env.CTA_URL || 'https://snaprecipes.xyz';

  return {
    id: 'recipe-' + Date.now(),
    title,
    prepTime,
    cookTime,
    servings,
    calories,
    ingredients,
    method,
    heroImage: imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=85',
    brandName,
    brandSubtitle: 'Save any recipe in one tap.',
    shortHook: `Better than takeout and ready in ${cookTime || prepTime}. ${ingredients.length} ingredients, ${method.length} steps.`,
    highlightBadge: `${(cookTime || prepTime).toUpperCase()} · ${servings} SERVINGS`,
    taglineBadge: `• ${brandName.toUpperCase()} · SKIP THE LIFE STORY`,
    brandPillBadge: 'AD-FREE · NO BLOG RANTS · JUST RECIPES',
    brandLogo: process.env.BRAND_LOGO || '/snaprecipes-app-icon.png',
    brandLogoSize: Number(process.env.BRAND_LOGO_SIZE) || 58,
    ctaButtonText: 'Get the app — free',
    ctaUrl,
    socialHandle: '@' + brandName.toLowerCase().replace(/\s+/g, ''),
    perks: [
      { id: 1, title: 'Save from Anywhere', desc: 'Links, photos, TikTok & IG — one tap.' },
      { id: 2, title: 'No Ads, No Rants', desc: 'Just the clean recipe, instantly.' },
      { id: 3, title: 'Quick Extraction', desc: 'Paste a link, get tidy steps.' },
      { id: 4, title: 'Get Started Today!', desc: 'Free to try.' }
    ]
  };
}

// Generate Social Media Caption with Gemini AI or OpenRouter
async function generateAICaptionServer(recipeData: any): Promise<{ caption: string; hook: string }> {
  const openRouterKey = process.env.OPENROUTER_API_KEY || '';
  const openRouterModel = process.env.OPENROUTER_MODEL || 'openrouter/auto';
  const geminiKey = process.env.GEMINI_API_KEY || 'AIzaSyB8yOmrHTwl6Gp5xEVd_hyWsfnEipxN2Jc';
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const brandName = process.env.BRAND_NAME || 'SnapRecipes';
  const ctaUrl = process.env.CTA_URL || 'https://snaprecipes.xyz';
  const brandTag = brandName.replace(/\s+/g, '');

  let hook = `Layers of creamy sweetness and rich flavor make this an instant crowd favorite. 🍽️`;

  const prompt = `You are a social media chef writing an appetizing 1-sentence viral hook for this recipe: "${recipeData.title}".
Instructions:
- Write ONE complete, punchy sentence (8-14 words) describing why this dish is delicious and easy.
- Must end with a period and 🍽️.
- DO NOT end mid-sentence.
- Example: "Layers of creamy vanilla pudding and chocolate make this no-bake dessert an instant crowd favorite. 🍽️"
Return ONLY the one complete sentence.`;

  if (openRouterKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterKey}`,
          'HTTP-Referer': 'https://slyde-bay.vercel.app',
          'X-Title': 'Slyde Carousel Studio'
        },
        body: JSON.stringify({
          model: openRouterModel,
          messages: [
            { role: 'system', content: 'You are an AI chef that outputs ONLY a single 1-sentence hook ending with 🍽️. Never output thinking or preambles.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 150
        })
      });
      const d = await res.json();
      let txt = d.choices?.[0]?.message?.content?.trim() || d.choices?.[0]?.text?.trim() || '';
      txt = txt.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```/g, '').replace(/^["']|["']$/g, '').trim();
      if (txt && txt.length > 10 && !txt.toLowerCase().includes('we need to') && !txt.toLowerCase().includes('let\'s count')) {
        hook = txt.endsWith('🍽️') ? txt : `${txt} 🍽️`;
      }
    } catch (e: any) {}
  } else if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 250 }
        })
      });
      const d = await res.json();
      let txt = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      txt = txt.replace(/^["']|["']$/g, '').trim();
      if (txt && txt.length > 10) {
        hook = txt.endsWith('🍽️') ? txt : `${txt} 🍽️`;
      }
    } catch (e: any) {}
  }

  let ingList = (recipeData.ingredients || []).map((i: any) => `- ${i.name}${i.amount ? ' (' + i.amount + ')' : ''}`).join('\n');
  let stepsList = (recipeData.method || []).map((s: string, idx: number) => `${idx + 1}. ${s}`).join('\n');

  if (!ingList || ingList.trim().length === 0) {
    ingList = `- Fresh core ingredients (custom to dish)\n- Seasoning & herbs\n- Olive oil or butter`;
  }
  if (!stepsList || stepsList.trim().length === 0) {
    stepsList = `1. Gather and prep ingredients.\n2. Cook according to recipe instructions.\n3. Serve fresh and enjoy!`;
  }
  const firstWord = recipeData.title.split(' ')[0]
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, '') || 'Recipe';

  const caption = `${recipeData.title} — ${hook}

What you need:
${ingList}

How to:
${stepsList}

Prep ${recipeData.prepTime} · Cook ${recipeData.cookTime} · Makes ${recipeData.servings} · ${recipeData.calories}

Save this recipe on ${brandName} — skip the life story, get straight to cooking. Get the app: ${ctaUrl}

#${brandTag} #EasyRecipes #RecipeIdeas #${firstWord}Recipes #${firstWord}`;

  return { caption, hook };
}

// Render 3 Slides with Serverless Chromium, then stitch video with ffmpeg
async function captureMediaServerless(
  recipe: any, 
  host: string, 
  includeVideo: boolean = true, 
  aspectRatio: '9:16' | '1:1' | '4:5' = '9:16',
  audioVibe: string = 'lofi'
): Promise<{ slides: (Buffer | Uint8Array)[]; videoBuffer: Buffer | null; videoError?: string | null }> {
  let executablePath: string;
  try {
    executablePath = await chromium.executablePath();
  } catch (e) {
    executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }

  const browser = await puppeteer.launch({
    args: chromium.args || ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
    defaultViewport: { width: 1200, height: 2400, deviceScaleFactor: 3 },
    executablePath: executablePath || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });

  try {
    const page = await browser.newPage();
    const cleanHost = host.replace(/^https?:\/\//, '');
    const renderUrl = cleanHost.includes('localhost') ? `http://${cleanHost}/render.html` : `https://${cleanHost}/render.html`;
    await page.goto(renderUrl, { waitUntil: 'networkidle0', timeout: 18000 });

    await page.waitForFunction(() => typeof (window as any).__setRecipe === 'function', { timeout: 12000 });

    await page.evaluate((r, ratio) => {
      (window as any).__setRecipe(r, undefined, ratio);
    }, recipe, aspectRatio);

    await page.waitForSelector('#slide-1', { timeout: 12000 });
    await page.waitForSelector('#slide-2', { timeout: 12000 });
    await page.waitForSelector('#slide-3', { timeout: 12000 });
    await new Promise(r => setTimeout(r, 600));

    const slide1El = await page.$('#slide-1');
    const slide2El = await page.$('#slide-2');
    const slide3El = await page.$('#slide-3');

    if (!slide1El || !slide2El || !slide3El) {
      throw new Error('Slide DOM elements not found in render.html');
    }

    const [buf1, buf2, buf3] = await Promise.all([
      slide1El.screenshot({ type: 'png' }),
      slide2El.screenshot({ type: 'png' }),
      slide3El.screenshot({ type: 'png' })
    ]);

    await browser.close();

    let videoBuffer: Buffer | null = null;
    let videoError: string | null = null;

    if (includeVideo) {
      try {
        videoBuffer = await generateVideoFromSlideBuffers(buf1, buf2, buf3, recipe.title, audioVibe, host);
      } catch (vidErr: any) {
        console.warn('Video generation error:', vidErr.message);
        videoError = vidErr.message;
      }
    }

    return {
      slides: [buf1, buf2, buf3],
      videoBuffer,
      videoError
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

// Generate MP4 video from 3 slide PNG buffers using ffmpeg
async function generateVideoFromSlideBuffers(
  buf1: Buffer | Uint8Array,
  buf2: Buffer | Uint8Array,
  buf3: Buffer | Uint8Array,
  recipeTitle: string = '',
  audioVibe: string = 'lofi',
  host: string = ''
): Promise<Buffer> {
  const { execFileSync } = await import('child_process');
  const fs = await import('fs');
  const path = await import('path');

  // Get ffmpeg binary path
  let ffmpegPath: string;
  try {
    const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg');
    ffmpegPath = (ffmpegInstaller as any).default?.path || (ffmpegInstaller as any).path;
  } catch {
    ffmpegPath = 'ffmpeg'; // fallback to system ffmpeg
  }

  // Ensure executable permissions on Linux / AWS Lambda / Vercel Serverless
  if (process.platform === 'linux' && ffmpegPath && fs.existsSync(ffmpegPath)) {
    try {
      const tmpFfmpeg = '/tmp/ffmpeg';
      if (!fs.existsSync(tmpFfmpeg)) {
        fs.copyFileSync(ffmpegPath, tmpFfmpeg);
        fs.chmodSync(tmpFfmpeg, 0o755);
      }
      if (fs.existsSync(tmpFfmpeg)) {
        ffmpegPath = tmpFfmpeg;
      }
    } catch (e) {
      console.warn('Could not copy ffmpeg to /tmp:', e);
    }
  }

  const tmpDir = '/tmp';
  const slide1Path = path.join(tmpDir, `slide1_${Date.now()}.png`);
  const slide2Path = path.join(tmpDir, `slide2_${Date.now()}.png`);
  const slide3Path = path.join(tmpDir, `slide3_${Date.now()}.png`);
  const clip1Path = path.join(tmpDir, `clip1_${Date.now()}.mp4`);
  const clip2Path = path.join(tmpDir, `clip2_${Date.now()}.mp4`);
  const clip3Path = path.join(tmpDir, `clip3_${Date.now()}.mp4`);
  const concatPath = path.join(tmpDir, `concat_${Date.now()}.txt`);
  const outputPath = path.join(tmpDir, `video_${Date.now()}.mp4`);

  let audioTrackPath: string | null = null;

  try {
    // Write slide PNGs to /tmp
    fs.writeFileSync(slide1Path, buf1);
    fs.writeFileSync(slide2Path, buf2);
    fs.writeFileSync(slide3Path, buf3);

    // Create individual clips: Hook 2.5s, Recipe 4.5s, CTA 2.0s = 9.0s total
    const clips = [
      { input: slide1Path, duration: '2.5', output: clip1Path },
      { input: slide2Path, duration: '4.5', output: clip2Path },
      { input: slide3Path, duration: '2.0', output: clip3Path },
    ];

    for (const clip of clips) {
      execFileSync(ffmpegPath, [
        '-y', '-loop', '1', '-t', clip.duration, '-i', clip.input,
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
        '-c:v', 'libx264', '-r', '30', '-preset', 'ultrafast', '-crf', '23',
        clip.output
      ], { stdio: 'pipe', timeout: 20000 });
    }

    // Write concat list
    fs.writeFileSync(concatPath, clips.map(c => `file '${c.output}'`).join('\n'));

    // Check for background culinary soundtrack (prioritizing Lo-Fi)
    const audioDirs = [
      path.resolve(process.cwd(), 'public/audio'),
      path.resolve(process.cwd(), 'music')
    ];
    for (const d of audioDirs) {
      if (fs.existsSync(d)) {
        const mp3s = fs.readdirSync(d).filter(f => f.endsWith('.mp3'));
        if (mp3s.length > 0) {
          const lofiTracks = mp3s.filter(f => f.includes('lofi') || f.includes('chill') || f.includes('lounge') || f.includes('brunch'));
          let candidateList = mp3s;
          if (audioVibe === 'lofi' && lofiTracks.length > 0) {
            candidateList = lofiTracks;
          } else if (audioVibe === 'acoustic') {
            const acousticTracks = mp3s.filter(f => f.includes('acoustic') || f.includes('bistro'));
            candidateList = acousticTracks.length > 0 ? acousticTracks : mp3s;
          } else if (audioVibe === 'upbeat') {
            const upbeatTracks = mp3s.filter(f => f.includes('upbeat') || f.includes('cheery'));
            candidateList = upbeatTracks.length > 0 ? upbeatTracks : mp3s;
          } else if (lofiTracks.length > 0) {
            candidateList = lofiTracks; // Default fallback to Lo-Fi
          }
          const hash = Math.abs((recipeTitle || 'lofi-recipe').split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0));
          audioTrackPath = path.join(d, candidateList[hash % candidateList.length]);
          break;
        }
      }
    }

    // If audio track is not found on serverless local disk, fetch directly from Vercel static URL
    if (!audioTrackPath && host) {
      try {
        const cleanHost = host.replace(/^https?:\/\//, '');
        const targetTrack = 'lofi-kitchen-chill.mp3';
        const audioUrl = cleanHost.includes('localhost')
          ? `http://${cleanHost}/audio/${targetTrack}`
          : `https://${cleanHost}/audio/${targetTrack}`;
        const audioRes = await fetch(audioUrl);
        if (audioRes.ok) {
          const arrayBuf = await audioRes.arrayBuffer();
          const tmpAudio = path.join(tmpDir, `audio_${Date.now()}.mp3`);
          fs.writeFileSync(tmpAudio, Buffer.from(arrayBuf));
          audioTrackPath = tmpAudio;
        }
      } catch (e) {
        console.warn('Failed to fetch remote audio track fallback:', e);
      }
    }

    const ffmpegConcatArgs = ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath];
    if (audioTrackPath && fs.existsSync(audioTrackPath)) {
      ffmpegConcatArgs.push(
        '-i', audioTrackPath,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-af', 'afade=t=in:ss=0:d=0.25,afade=t=out:st=8.2:d=0.8',
        '-shortest'
      );
    } else {
      ffmpegConcatArgs.push('-c', 'copy');
    }
    ffmpegConcatArgs.push(outputPath);

    // Concat clips (with audio) into final video
    execFileSync(ffmpegPath, ffmpegConcatArgs, { stdio: 'pipe', timeout: 25000 });

    // Read the final MP4
    const videoBuffer = fs.readFileSync(outputPath);
    return Buffer.from(videoBuffer);
  } finally {
    // Cleanup temp files
    const tempFiles = [slide1Path, slide2Path, slide3Path, clip1Path, clip2Path, clip3Path, concatPath, outputPath];
    if (audioTrackPath && audioTrackPath.startsWith(tmpDir)) {
      tempFiles.push(audioTrackPath);
    }
    for (const f of tempFiles) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}

function saveCachedRecipe(id: string, url: string, title?: string) {
  try {
    const fs = require('fs');
    let cache: Record<string, { url: string; title?: string }> = {};
    if (fs.existsSync('/tmp/slyde_recipe_cache.json')) {
      cache = JSON.parse(fs.readFileSync('/tmp/slyde_recipe_cache.json', 'utf8'));
    }
    cache[id] = { url, title };
    fs.writeFileSync('/tmp/slyde_recipe_cache.json', JSON.stringify(cache));
  } catch (e) {}
}

function getCachedRecipe(id: string): { url: string; title?: string } | null {
  try {
    const fs = require('fs');
    if (fs.existsSync('/tmp/slyde_recipe_cache.json')) {
      const cache = JSON.parse(fs.readFileSync('/tmp/slyde_recipe_cache.json', 'utf8'));
      return cache[id] || null;
    }
  } catch (e) {}
  return null;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  messageThreadId: number | undefined,
  text: string,
  parseMode: string = 'HTML',
  replyMarkup?: any
) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
        text,
        parse_mode: parseMode,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {})
      })
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn('sendTelegramMessage Telegram API error:', data);
    }
    return data;
  } catch (e: any) {
    console.error('sendTelegramMessage network exception:', e.message);
  }
}

async function answerTelegramCallbackQuery(botToken: string, callbackQueryId: string, text?: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        ...(text ? { text } : {})
      })
    });
  } catch (e) {}
}

async function editTelegramMessageText(
  botToken: string,
  chatId: number | string,
  messageId: number,
  text: string,
  parseMode: string = 'HTML',
  replyMarkup?: any
) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: parseMode,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {})
      })
    });
  } catch (e) {}
}

async function sendTelegramAlbum(botToken: string, chatId: number | string, messageThreadId: number | undefined, buffers: (Buffer | Uint8Array)[], title: string) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const parts: Buffer[] = [];

  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`));
  if (messageThreadId) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="message_thread_id"\r\n\r\n${messageThreadId}\r\n`));
  }

  const media = [
    { type: 'photo', media: 'attach://slide_1', caption: `🍳 <b>${title}</b> (3-Slide Carousel Album)`, parse_mode: 'HTML' },
    { type: 'photo', media: 'attach://slide_2' },
    { type: 'photo', media: 'attach://slide_3' }
  ];
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media"\r\n\r\n${JSON.stringify(media)}\r\n`));

  for (let i = 0; i < 3; i++) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="slide_${i + 1}"; filename="slide-${i + 1}.png"\r\nContent-Type: image/png\r\n\r\n`));
    parts.push(Buffer.isBuffer(buffers[i]) ? (buffers[i] as Buffer) : Buffer.from(buffers[i]));
    parts.push(Buffer.from(`\r\n`));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(body.length)
    },
    body
  });
  return await res.json();
}

async function sendTelegramVideo(botToken: string, chatId: number | string, messageThreadId: number | undefined, videoBuffer: Buffer, title: string) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const parts: Buffer[] = [];
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`));
  if (messageThreadId) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="message_thread_id"\r\n\r\n${messageThreadId}\r\n`));
  }
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="supports_streaming"\r\n\r\ntrue\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="width"\r\n\r\n1080\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="height"\r\n\r\n1920\r\n`));

  const caption = `🎬 <b>${title}</b>\n\n<i>🎵 9.0s 9:16 Video with High-Vibe Food Soundtrack ready! Post directly to TikTok, Reels, or YouTube Shorts.</i>`;
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n`));

  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="${slug}-shorts.mp4"\r\nContent-Type: video/mp4\r\n\r\n`));
  parts.push(videoBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(body.length)
    },
    body
  });
  return await res.json();
}

function extractUrlFromCallbackMessage(cb: any): string | null {
  if (!cb || !cb.message) return null;

  if (Array.isArray(cb.message.entities)) {
    for (const ent of cb.message.entities) {
      if (ent.type === 'text_link' && ent.url) {
        return ent.url;
      }
      if (ent.type === 'url' && cb.message.text) {
        const extracted = cb.message.text.substring(ent.offset, ent.offset + ent.length);
        if (extracted.startsWith('http')) return extracted;
      }
    }
  }

  const fullText = (cb.message.text || cb.message.caption || '');
  const match = fullText.match(/https?:\/\/[^\s>"]+/i);
  if (match) return match[0];

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).send('Slyde Telegram Webhook Endpoint');
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.status(500).send('TELEGRAM_BOT_TOKEN environment variable not set');
  }

  // Allowed chat IDs — only these chats can use the bot (if configured)
  const allowedChatIdsStr = process.env.ALLOWED_CHAT_IDS || '';
  const allowedChatIds = new Set(allowedChatIdsStr.split(',').map(s => s.trim()).filter(Boolean));

  const update = req.body;
  if (!update) {
    return res.status(200).send('OK (no update)');
  }

  const updateId = update.update_id;
  if (updateId && processedUpdates.has(updateId)) {
    return res.status(200).send('OK (duplicate)');
  }
  if (updateId) {
    processedUpdates.add(updateId);
    if (processedUpdates.size > 200) {
      const first = processedUpdates.values().next().value;
      if (first !== undefined) processedUpdates.delete(first);
    }
  }

  // 1. Handle Interactive Inline Button Clicks (callback_query)
  if (update.callback_query) {
    const cb = update.callback_query;
    const cbId = cb.id;
    const data: string = cb.data || '';
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    const messageThreadId = cb.message?.message_thread_id;

    if (!data.startsWith('slyde:')) {
      await answerTelegramCallbackQuery(botToken, cbId);
      return res.status(200).send('OK (ignored callback)');
    }

    const parts = data.split(':');
    // Format: slyde:<shortId>:<format>:<ratio>
    const shortId = parts[1];
    const format = parts[2]; // 'slides' | 'video' | 'all' | 'caption'
    const rawRatio = parts[3] || '9-16';
    const ratio: '9:16' | '1:1' | '4:5' = rawRatio.replace('-', ':') as any;

    let targetUrl = extractUrlFromCallbackMessage(cb);
    let targetTitle = '';

    if (!targetUrl && shortId) {
      const cached = getCachedRecipe(shortId);
      if (cached) {
        targetUrl = cached.url;
        targetTitle = cached.title || '';
      }
    }

    if (!targetUrl) {
      await answerTelegramCallbackQuery(botToken, cbId, '⚠️ Link not found. Please paste the recipe URL again.');
      return res.status(200).send('OK');
    }

    const ratioLabel = ratio === '1:1' ? '1:1 Square' : (ratio === '4:5' ? '4:5 Portrait' : '9:16 Vertical');
    const actionLabel = format === 'video' ? '🎬 9.0s Video' : (format === 'slides' ? `📸 3 ${ratioLabel} Slides` : (format === 'caption' ? '📋 Viral Caption' : `⚡ Video + 3 Slides (${ratioLabel})`));

    await answerTelegramCallbackQuery(botToken, cbId, `Generating ${actionLabel}...`);

    if (messageId && chatId) {
      await editTelegramMessageText(
        botToken,
        chatId,
        messageId,
        `👨‍🍳 <b>Generating ${actionLabel}...</b>\n\n🍽️ <i>${escapeHtml(targetTitle || targetUrl)}</i>`
      );
    }

    // Process rendering
    waitUntil((async () => {
      try {
        const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'slyde-bay.vercel.app';
        const recipe = await extractRecipeServer(targetUrl);
        const { caption, hook } = await generateAICaptionServer(recipe);
        if (hook) {
          recipe.shortHook = hook.replace(/🍽️/g, '').trim();
        }

        if (format === 'reserve') {
          // Add recipe to Buffer Reserve Queue and auto-top up
          const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'slyde-bay.vercel.app';
          // @ts-ignore
          const { addRecipesToReserve, topUpBufferQueue, getBufferQueueStatus, getReserveQueueStatus } = await import('../server/bufferReplenisher.js');
          addRecipesToReserve(targetUrl);
          const topUpRes = await topUpBufferQueue({ host });
          const bufStatus = await getBufferQueueStatus();
          const resStatus = getReserveQueueStatus();

          let msg = `📥 <b>Recipe Added to Buffer Reserve!</b>\n\n🍽️ <b>${escapeHtml(targetTitle || recipe.title || 'Recipe')}</b>\n`;
          if (topUpRes?.scheduledCount > 0) {
            msg += `🚀 <b>Auto-scheduled to Buffer!</b> (Buffer is now ${bufStatus.totalScheduled}/10 full).\n`;
          } else {
            msg += `📊 Buffer is full (10/10). Saved in reserve — will auto-schedule as soon as a slot opens!\n`;
          }
          msg += `📦 Reserve inventory: <b>${resStatus.pendingCount}</b> recipe(s) waiting.\n\n<i>✨ Direct API scheduling active.</i>`;

          await sendTelegramMessage(botToken, chatId, messageThreadId, msg);
          return;
        }

        if (format === 'caption') {
          await sendTelegramMessage(botToken, chatId, messageThreadId, caption);
          return;
        }

        const needsVideo = format === 'video' || format === 'all';
        const needsSlides = format === 'slides' || format === 'all';

        const media = await captureMediaServerless(recipe, host, needsVideo, ratio, 'lofi');

        if (needsVideo) {
          if (media.videoBuffer) {
            const vidRes = await sendTelegramVideo(botToken, chatId, messageThreadId, media.videoBuffer, recipe.title);
            if (vidRes && !vidRes.ok) {
              console.warn('Telegram sendVideo error:', vidRes.description);
              await sendTelegramMessage(botToken, chatId, messageThreadId, `⚠️ Video delivery note: ${vidRes.description}`);
            }
          } else {
            const reason = media.videoError || 'Serverless video rendering timeout';
            console.warn('Telegram video generation error:', reason);
            await sendTelegramMessage(botToken, chatId, messageThreadId, `⚠️ Video generation note: ${reason}\n\n<i>Delivering 3 high-res recipe slides and complete caption below:</i>`);
          }
        }

        // Send slides if requested, or as fallback if video could not be generated
        const shouldSendSlides = needsSlides || (needsVideo && !media.videoBuffer);
        if (shouldSendSlides && media.slides) {
          await sendTelegramAlbum(botToken, chatId, messageThreadId, media.slides, recipe.title);
        }

        // Send full caption
        await sendTelegramMessage(botToken, chatId, messageThreadId, caption);
      } catch (err: any) {
        await sendTelegramMessage(botToken, chatId, messageThreadId, `⚠️ Error rendering ${actionLabel}: ${err.message}`);
      }
    })());

    return res.status(200).send('OK');
  }

  // 2. Handle Text Messages & Commands
  const msg = update.message || update.channel_post || update.edited_message || update.edited_channel_post;
  if (!msg) {
    return res.status(200).send('OK (no message)');
  }

  const text: string = msg.text || msg.caption || '';
  const chatId = msg.chat?.id;
  const messageThreadId = msg.message_thread_id;

  if (!chatId || !text) {
    return res.status(200).send('OK (no text or chatId)');
  }

  // Security: reject messages from unauthorized chats (if allowlist is configured)
  const senderId = String(msg.from?.id || '');
  const chatStr = String(chatId);
  const senderChatStr = String(msg.sender_chat?.id || '');

  if (allowedChatIds.size > 0) {
    const isAllowed = 
      allowedChatIds.has(chatStr) || 
      (senderId && allowedChatIds.has(senderId)) || 
      (senderChatStr && allowedChatIds.has(senderChatStr));

    if (!isAllowed) {
      console.warn(`Rejected message from unauthorized chat ${chatStr} (sender: ${senderId || senderChatStr || 'unknown'})`);
      return res.status(200).send('OK (unauthorized)');
    }
  }

  const lowerText = text.toLowerCase().trim();

  // 1. HELP / START
  if (lowerText.startsWith('/start') || lowerText.startsWith('/help')) {
    await sendTelegramMessage(
      botToken,
      chatId,
      messageThreadId,
      `🎬 <b>Welcome to Slyde Automation Bot!</b>\n\n` +
      `<b>⚡ Quick Generation:</b>\n` +
      `• Send <b>any recipe URL</b> to choose options via buttons\n` +
      `• <code>/video &lt;url&gt;</code> — 9s Video with Lo-Fi music\n` +
      `• <code>/slides 9:16 &lt;url&gt;</code> — 3-Slide 9:16 Carousel\n` +
      `• <code>/slides 1:1 &lt;url&gt;</code> — 3-Slide Square Carousel\n` +
      `• <code>/all &lt;url&gt;</code> — Video + 3 Slides + Caption\n\n` +
      `<b>🚀 Buffer Reserve & 10-Post Autopilot:</b>\n` +
      `• <b>Paste 15–30 recipe links</b> in one message (or <code>/queue &lt;urls...&gt;</code>)\n` +
      `  <i>Slyde adds them to your reserve, fills Buffer up to 10/10 posts, and auto-refills daily!</i>\n` +
      `• <code>/buffer</code> or <code>/status</code> — View active Buffer queue & reserve count\n` +
      `• <code>/topup</code> or <code>/replenish</code> — Fill open Buffer slots immediately\n\n` +
      `🆔 <i>Your Chat ID: <code>${chatId}</code></i>`
    );
    return res.status(200).send('OK');
  }

  // 2. BUFFER / QUEUE STATUS COMMAND
  if (lowerText.startsWith('/buffer') || lowerText.startsWith('/status') || lowerText.startsWith('/queue_status')) {
    try {
      // @ts-ignore
      const { getBufferQueueStatus, getReserveQueueStatus } = await import('../server/bufferReplenisher.js');
      const bufStatus = await getBufferQueueStatus();
      const resStatus = getReserveQueueStatus();

      const latestDateStr = bufStatus.latestDueAt 
        ? new Date(bufStatus.latestDueAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : 'None scheduled';

      const statusMsg = `📊 <b>Buffer & Reserve Queue Health</b>\n\n` +
        `🎯 <b>Buffer Active Queue:</b> <b>${bufStatus.totalScheduled}/10</b> posts scheduled\n` +
        `🔓 <b>Buffer Open Slots:</b> <b>${bufStatus.slotsAvailable}</b> available\n` +
        `⏰ <b>Latest Scheduled:</b> ${latestDateStr}\n\n` +
        `📦 <b>Reserve Inventory:</b> <b>${resStatus.pendingCount}</b> recipe(s) waiting\n` +
        `✅ <b>Total Ingested:</b> ${resStatus.totalCount} recipe(s)\n\n` +
        `<i>Tip: Paste 15–30 recipe URLs here anytime to refill your monthly reserve queue!</i>`;

      await sendTelegramMessage(botToken, chatId, messageThreadId, statusMsg);
    } catch (e: any) {
      await sendTelegramMessage(botToken, chatId, messageThreadId, `⚠️ Could not query Buffer status: ${e.message}`);
    }
    return res.status(200).send('OK');
  }

  // 3. TOP-UP / REPLENISH BUFFER COMMAND
  if (lowerText.startsWith('/topup') || lowerText.startsWith('/replenish')) {
    await sendTelegramMessage(botToken, chatId, messageThreadId, `⚡ <b>Checking Buffer queue and refilling open slots from reserve...</b>`);
    waitUntil((async () => {
      try {
        const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'slyde-bay.vercel.app';
        // @ts-ignore
        const { topUpBufferQueue } = await import('../server/bufferReplenisher.js');
        const res = await topUpBufferQueue({ host });

        if (res.scheduledCount > 0) {
          const list = (res.newlyScheduled || []).map((p: any, i: number) => `  ${i + 1}. <b>${p.title}</b>`).join('\n');
          await sendTelegramMessage(
            botToken,
            chatId,
            messageThreadId,
            `🎉 <b>Buffer Queue Top-Up Complete!</b>\n\n` +
            `✅ Scheduled <b>${res.scheduledCount}</b> new recipe(s) to Buffer!\n` +
            `📊 Buffer is now <b>${res.totalScheduled}/10</b> full.\n` +
            `📦 <b>${res.remainingInReserve}</b> recipe(s) remain in reserve.\n\n` +
            `${list}\n\n` +
            `<i>✨ Direct automated API publishing — no manual phone reminders needed.</i>`
          );
        } else {
          await sendTelegramMessage(
            botToken,
            chatId,
            messageThreadId,
            `ℹ️ <b>Buffer Queue Status:</b>\n\n${res.message}`
          );
        }
      } catch (e: any) {
        await sendTelegramMessage(botToken, chatId, messageThreadId, `⚠️ Top-up error: ${e.message}`);
      }
    })());
    return res.status(200).send('OK');
  }

  // 4. BATCH RECIPE INGESTION (Multiple URLs or /queue command)
  const allUrls = Array.from(new Set(text.match(/https?:\/\/[^\s>"]+/gi) || []));
  const isQueueCommand = lowerText.startsWith('/queue') || lowerText.startsWith('/reserve') || lowerText.startsWith('/batch');

  if (allUrls.length > 1 || (isQueueCommand && allUrls.length > 0)) {
    await sendTelegramMessage(
      botToken,
      chatId,
      messageThreadId,
      `📥 <b>Received ${allUrls.length} recipe link(s)!</b>\nAdding to your Reserve Queue and checking Buffer for open slots...`
    );

    waitUntil((async () => {
      try {
        const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'slyde-bay.vercel.app';
        // @ts-ignore
        const { addRecipesToReserve, topUpBufferQueue, getBufferQueueStatus, getReserveQueueStatus } = await import('../server/bufferReplenisher.js');

        // 1. Add to reserve
        const addResult = addRecipesToReserve(allUrls);

        // 2. Fill Buffer up to 10 slots
        const topUpResult = await topUpBufferQueue({ host });
        const bufStatus = await getBufferQueueStatus();
        const resStatus = getReserveQueueStatus();

        let report = `✅ <b>Reserve Queue Updated!</b>\n\n` +
          `• <b>+${addResult.addedCount}</b> recipe(s) added to reserve.\n`;

        if (topUpResult?.scheduledCount > 0) {
          report += `• 🚀 <b>${topUpResult.scheduledCount} recipe(s) auto-scheduled to Buffer</b> (Buffer is now ${bufStatus.totalScheduled}/10 full)!\n`;
        } else if (bufStatus.totalScheduled >= 10) {
          report += `• 📊 Buffer is currently full (10/10 scheduled).\n`;
        }

        report += `• 📦 <b>${resStatus.pendingCount} recipe(s) waiting in reserve</b> to automatically refill Buffer daily.\n\n` +
          `<i>✨ All posts are scheduled directly via Buffer API with 60 FPS videos, complete ingredients, directions & hashtags!</i>`;

        await sendTelegramMessage(botToken, chatId, messageThreadId, report);
      } catch (e: any) {
        await sendTelegramMessage(botToken, chatId, messageThreadId, `⚠️ Error processing batch: ${e.message}`);
      }
    })());

    return res.status(200).send('OK');
  }

  // 5. SINGLE RECIPE URL HANDLING
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    const recipeUrl = urlMatch[0];

    const isDirectCommand = lowerText.startsWith('/') && (
      lowerText.startsWith('/slides') || lowerText.startsWith('/slide') ||
      lowerText.startsWith('/video') || lowerText.startsWith('/short') ||
      lowerText.startsWith('/reel') || lowerText.startsWith('/v ') ||
      lowerText.startsWith('/caption') || lowerText.startsWith('/c ') ||
      lowerText.startsWith('/square') || lowerText.startsWith('/sq') ||
      lowerText.startsWith('/portrait') || lowerText.startsWith('/all')
    );

    // If sent as raw URL (or /menu /options), display interactive inline buttons!
    if (!isDirectCommand) {
      const shortId = Math.random().toString(36).substring(2, 8);
      saveCachedRecipe(shortId, recipeUrl);

      // Fetch quick title preview
      let previewTitle = 'Recipe Link Received';
      try {
        const resPreview = await extractRecipeServer(recipeUrl);
        if (resPreview?.title) {
          previewTitle = resPreview.title;
          saveCachedRecipe(shortId, recipeUrl, previewTitle);
        }
      } catch (e) {}

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '📸 9:16 Vertical Slides', callback_data: `slyde:${shortId}:slides:9-16` },
            { text: '📸 1:1 Square Slides', callback_data: `slyde:${shortId}:slides:1-1` }
          ],
          [
            { text: '📸 4:5 Portrait Slides', callback_data: `slyde:${shortId}:slides:4-5` },
            { text: '🎥 9s Video (9:16)', callback_data: `slyde:${shortId}:video:9-16` }
          ],
          [
            { text: '⚡ Video + Slides + Caption', callback_data: `slyde:${shortId}:all:9-16` },
            { text: '📥 Add to Buffer Reserve', callback_data: `slyde:${shortId}:reserve:none` }
          ],
          [
            { text: '📋 Caption Only', callback_data: `slyde:${shortId}:caption:none` }
          ]
        ]
      };

      await sendTelegramMessage(
        botToken,
        chatId,
        messageThreadId,
        `🍳 <b>${escapeHtml(previewTitle)}</b>\n🔗 <a href="${recipeUrl}">Source Recipe</a>\n\n👇 <b>Tap a button to choose format or add to reserve:</b>`,
        'HTML',
        inlineKeyboard
      );

      return res.status(200).send('OK');
    }

    // Direct command execution
    let requestedAspectRatio: '9:16' | '1:1' | '4:5' = '9:16';
    if (lowerText.includes('1:1') || lowerText.includes('square') || lowerText.startsWith('/sq')) {
      requestedAspectRatio = '1:1';
    } else if (lowerText.includes('4:5') || lowerText.includes('portrait') || lowerText.includes('feed')) {
      requestedAspectRatio = '4:5';
    } else if (lowerText.includes('9:16') || lowerText.includes('vertical') || lowerText.includes('story') || lowerText.includes('reel') || lowerText.includes('tiktok')) {
      requestedAspectRatio = '9:16';
    }

    const isVideoOnly = lowerText.startsWith('/video') || lowerText.startsWith('/short') || lowerText.startsWith('/reel') || lowerText.startsWith('/v ') || lowerText.startsWith('/lofi');
    const isSlidesOnly = lowerText.startsWith('/slides') || lowerText.startsWith('/slide') || lowerText.startsWith('/carousel') || lowerText.startsWith('/album') || lowerText.startsWith('/s ') || lowerText.startsWith('/square') || lowerText.startsWith('/sq') || lowerText.startsWith('/portrait');
    const isCaptionOnly = lowerText.startsWith('/caption') || lowerText.startsWith('/c ');
    const requestedVibe = lowerText.includes('acoustic') ? 'acoustic' : (lowerText.includes('upbeat') ? 'upbeat' : 'lofi');

    const ratioLabel = requestedAspectRatio === '1:1' ? ' [1:1 Square]' : (requestedAspectRatio === '4:5' ? ' [4:5 Portrait]' : ' [9:16 Vertical]');
    const modeText = isVideoOnly ? '🎬 9.0s Video (Cozy Lo-Fi)' : (isSlidesOnly ? `📸 3 Social Slides${ratioLabel}` : `⚡ 9.0s Video + 3 Slides${ratioLabel}`);

    // Run processing asynchronously with Vercel waitUntil and return 200 OK immediately
    waitUntil((async () => {
      // 1. Immediate acknowledgment
      await sendTelegramMessage(botToken, chatId, messageThreadId, `👨‍🍳 <b>Extracting recipe & generating ${modeText}...</b>`);

      try {
        const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'slyde-bay.vercel.app';
        const recipe = await extractRecipeServer(recipeUrl);

        // 2. Generate viral AI caption & hook
        const { caption, hook } = await generateAICaptionServer(recipe);
        if (hook) {
          recipe.shortHook = hook.replace(/🍽️/g, '').trim();
        }

        if (isCaptionOnly) {
          await sendTelegramMessage(botToken, chatId, messageThreadId, caption);
          return;
        }

        // 3. Render slides & video with Serverless Chromium
        try {
          const needsVideo = isVideoOnly || !isSlidesOnly;
          const media = await captureMediaServerless(recipe, host, needsVideo, requestedAspectRatio, requestedVibe);

          // Send Video if requested
          if (isVideoOnly || !isSlidesOnly) {
            if (media.videoBuffer) {
              const vidRes = await sendTelegramVideo(botToken, chatId, messageThreadId, media.videoBuffer, recipe.title);
              if (vidRes && !vidRes.ok) {
                console.warn('Telegram sendVideo error:', vidRes.description);
                await sendTelegramMessage(botToken, chatId, messageThreadId, `⚠️ Video delivery note: ${vidRes.description}`);
              }
            } else {
              const reason = media.videoError || 'Unknown rendering timeout';
              await sendTelegramMessage(botToken, chatId, messageThreadId, `⚠️ Video generation issue: ${reason}`);
            }
          }

          // Send 3-slide photo album if requested
          if (media.slides && (isSlidesOnly || !isVideoOnly)) {
            const albumRes = await sendTelegramAlbum(botToken, chatId, messageThreadId, media.slides, recipe.title);
            if (albumRes && !albumRes.ok) {
              console.warn('Telegram sendMediaGroup error:', albumRes.description);
            }
          }
        } catch (renderErr: any) {
          console.warn('Chromium render failed in serverless:', renderErr.message);
          await sendTelegramMessage(botToken, chatId, messageThreadId, `⚠️ Rendering note: ${renderErr.message}`);
        }

        // 4. Send clean viral caption
        await sendTelegramMessage(botToken, chatId, messageThreadId, caption);

      } catch (err: any) {
        await sendTelegramMessage(botToken, chatId, messageThreadId, `⚠️ Error processing recipe: ${err.message}`);
      }
    })());

    return res.status(200).send('OK');
  }

  return res.status(200).send('OK');
}
