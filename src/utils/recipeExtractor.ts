import { RecipeData } from '../types';

// Helper to format ISO 8601 duration (e.g., PT15M -> 15m)
function formatIsoDuration(duration?: string): string {
  if (!duration) return '5m';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;
  const hours = match[1] ? `${match[1]}h ` : '';
  const mins = match[2] ? `${match[2]}m` : '';
  return `${hours}${mins}`.trim() || '10m';
}

// Decode HTML entities (e.g., &#39; -> ', &amp; -> &)
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

// Fallback high quality food photography for extracted recipes based on keywords
function getFallbackImage(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('funnel') || t.includes('cake') || t.includes('doughnut') || t.includes('donut')) {
    return 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('pudding') || t.includes('banana')) {
    return 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('parfait') || t.includes('yogurt') || t.includes('berry')) {
    return 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('steak') || t.includes('beef') || t.includes('meat')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('salmon') || t.includes('fish') || t.includes('seafood')) {
    return 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('pasta') || t.includes('spaghetti')) {
    return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('chicken') || t.includes('wings')) {
    return 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('salad') || t.includes('bowl')) {
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=85';
  }
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=85';
}

// Generate an intelligent punchy hook based on title and ingredients
function generateHook(title: string, prep: string, cook: string, numIngredients: number): string {
  const isQuick = prep.includes('5') || prep.includes('10') || cook === '0m' || cook.includes('0');
  const t = title.toLowerCase();
  if (t.includes('funnel') || t.includes('cake') || t.includes('dessert') || t.includes('sweet')) {
    return `Crispy, golden, and dusted with powdered sugar — carnival perfection straight from your own kitchen.`;
  }
  if (isQuick) {
    return `No complicated tools — ${prep || '5 minutes'} and it's ready. Peak simplicity in every bite.`;
  }
  if (numIngredients <= 5) {
    return `Just ${numIngredients} simple ingredients. Zero hassle. Restaurant-quality flavors made effortless.`;
  }
  return `Rich, satisfying, and effortless. Restaurant-quality flavors made right at home.`;
}

// Helper to fetch HTML through multi-proxy fallback chain (bypasses Cloudflare & CORS)
async function fetchHtmlWithProxies(url: string): Promise<string | null> {
  const proxies: Array<{ url: string; headers: Record<string, string>; isJson: boolean }> = [
    // Proxy 1: Jina AI HTML Reader (Bypasses Cloudflare on Allrecipes, NYT, Food Network)
    {
      url: `https://r.jina.ai/${url}`,
      headers: { 'X-Return-Format': 'html' },
      isJson: false
    },
    // Proxy 2: AllOrigins JSON Proxy
    {
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      headers: {},
      isJson: true
    },
    // Proxy 3: CodeTabs CORS Proxy
    {
      url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      headers: {},
      isJson: false
    }
  ];

  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy.url, { headers: proxy.headers });
      if (res.ok) {
        if (proxy.isJson) {
          const data = await res.json();
          if (data.contents && data.contents.length > 500) {
            return data.contents;
          }
        } else {
          const text = await res.text();
          if (text && text.length > 500) {
            return text;
          }
        }
      }
    } catch (e) {
      // Continue to next proxy
    }
  }

  return null;
}

export async function extractRecipeFromUrl(url: string, brandDefaults?: { brandName?: string; socialHandle?: string; ctaUrl?: string; brandLogo?: string; brandLogoSize?: number }): Promise<RecipeData> {
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  const brandName = brandDefaults?.brandName || 'SnapRecipes';
  const socialHandle = brandDefaults?.socialHandle || '@snaprecipes';
  const ctaUrl = brandDefaults?.ctaUrl || 'snaprecipes.xyz';

  try {
    const html = await fetchHtmlWithProxies(cleanUrl);
    
    if (html) {
      // Look for JSON-LD structured schema
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
      let recipeObj: any = null;

      for (const scriptContent of jsonLdMatches) {
        try {
          const jsonStr = scriptContent.replace(/<script.*?>|<\/script>/gi, '').trim();
          const parsed = JSON.parse(jsonStr);
          const list = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);

          const found = list.find((item: any) => {
            if (!item) return false;
            const type = item['@type'];
            if (typeof type === 'string') return type.toLowerCase() === 'recipe';
            if (Array.isArray(type)) return type.some(t => String(t).toLowerCase() === 'recipe');
            return false;
          });

          if (found) {
            recipeObj = found;
            break;
          }
        } catch (e) {
          // continue parsing
        }
      }

// Helper to parse servings accurately from strings, numbers, or arrays
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
  
  // Range: "4 to 6", "4-6", "8-10"
  const rangeMatch = str.match(/(\d+)\s*(?:to|-)\s*(\d+)/i);
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]}`;
  }

  // Single number
  const numMatch = str.match(/(\d+)/);
  if (numMatch) {
    return numMatch[1];
  }

  return '4';
}

      if (recipeObj) {
        const title = decodeHtmlEntities(recipeObj.name || 'Delicious Recipe').trim();
        const prepTime = formatIsoDuration(recipeObj.prepTime) || '10m';
        const cookTime = formatIsoDuration(recipeObj.cookTime) || '15m';
        const servings = parseServings(recipeObj.recipeYield);
        const calories = recipeObj.nutrition?.calories ? `${recipeObj.nutrition.calories} cal` : '≈350 cal';
        const protein = recipeObj.nutrition?.proteinContent ? `${recipeObj.nutrition.proteinContent} protein` : 'High protein';

        // Extract primary photo URL
        let image = '';
        if (typeof recipeObj.image === 'string') {
          image = recipeObj.image;
        } else if (Array.isArray(recipeObj.image) && recipeObj.image.length > 0) {
          image = typeof recipeObj.image[0] === 'string' ? recipeObj.image[0] : recipeObj.image[0]?.url || '';
        } else if (recipeObj.image?.url) {
          image = recipeObj.image.url;
        }

        // Fallback to meta tags if no image in schema
        if (!image) {
          const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
          if (ogImgMatch) image = ogImgMatch[1];
        }
        if (!image) {
          image = getFallbackImage(title);
        }

// Clean and format ingredients into concise, natural strings
function cleanIngredient(raw: string): string {
  if (!raw) return '';
  let str = decodeHtmlEntities(raw).trim();

  // Standardize full units to clean short abbreviations
  str = str.replace(/\btablespoons?\b/gi, 'tbsp');
  str = str.replace(/\bteaspoons?\b/gi, 'tsp');
  str = str.replace(/\bpounds?\b/gi, 'lb');
  str = str.replace(/\bounces?\b/gi, 'oz');
  str = str.replace(/\bpackages?\b/gi, 'pkg');
  str = str.replace(/\bquarts?\b/gi, 'qt');
  str = str.replace(/\bpints?\b/gi, 'pt');

  // Fractions
  str = str.replace(/([1-9]\d*)\.5\d*/g, '$1 1/2');
  str = str.replace(/([1-9]\d*)\.25\d*/g, '$1 1/4');
  str = str.replace(/([1-9]\d*)\.75\d*/g, '$1 3/4');
  str = str.replace(/([1-9]\d*)\.333\d*/g, '$1 1/3');
  str = str.replace(/([1-9]\d*)\.666\d*/g, '$1 2/3');
  str = str.replace(/\b0\.5\d*/g, '1/2');
  str = str.replace(/\b0\.25\d*/g, '1/4');
  str = str.replace(/\b0\.75\d*/g, '3/4');
  str = str.replace(/\b0\.333\d*/g, '1/3');
  str = str.replace(/\b0\.666\d*/g, '2/3');
  str = str.replace(/\b0\s+([1-3]\/[2-4])/g, '$1');

  // Clean trailing fluff
  str = str.replace(/,\s*or\s+to\s+taste/gi, ' (to taste)');
  str = str.replace(/,\s*or\s+as\s+needed/gi, '');
  str = str.replace(/,\s*divided/gi, '');

  return str.trim();
}

        // Parse ingredients cleanly
        const rawIngredients: string[] = recipeObj.recipeIngredient || [];
        const ingredients = rawIngredients.slice(0, 10).map((raw) => {
          const cleaned = cleanIngredient(raw);
          // If already separated by dash (custom recipes)
          const parts = cleaned.split('—').length > 1 ? cleaned.split('—') : cleaned.split(' - ');
          if (parts.length > 1) {
            return { name: parts[0].trim(), amount: parts.slice(1).join(' - ').trim() };
          }
          return { name: cleaned, amount: '' };
        });

        // Parse instructions cleanly
        let method: string[] = [];
        if (Array.isArray(recipeObj.recipeInstructions)) {
          method = recipeObj.recipeInstructions.map((step: any) => {
            const text = typeof step === 'string' ? step : (step.text || '');
            return decodeHtmlEntities(text)
              .replace(/^Step\s*\d+:\s*/i, '')
              .replace(/^\d+\.\s*/, '')
              .replace(/Recipe developed by.*/i, '')
              .replace(/Recipe adapted from.*/i, '')
              .trim();
          }).filter((s: string) => s.length > 0).slice(0, 6);
        }

        if (ingredients.length === 0) {
          ingredients.push(
            { name: 'Core Main Ingredients', amount: '2 cups' },
            { name: 'Fresh Seasoning / Herbs', amount: 'To taste' },
            { name: 'Extra Virgin Olive Oil', amount: '2 tbsp' }
          );
        }

        if (method.length === 0) {
          method.push(
            'Gather and prepare all ingredients.',
            'Combine and cook according to recipe method.',
            'Serve fresh and enjoy!'
          );
        }

        return {
          id: `extracted-${Date.now()}`,
          title: title.toUpperCase(),
          shortHook: generateHook(title, prepTime, cookTime, ingredients.length),
          taglineBadge: `• ${brandName.toUpperCase()} · SKIP THE LIFE STORY`,
          heroImage: image,
          prepTime,
          cookTime,
          servings,
          calories,
          proteinCallout: protein,
          highlightBadge: `${prepTime.toUpperCase()} · ${servings} SERVINGS`,
          ingredients,
          method,
          brandName,
          brandSubtitle: 'Save any recipe in one tap.',
          brandPillBadge: 'AD-FREE · NO BLOG RANTS · JUST RECIPES',
          brandLogo: brandDefaults?.brandLogo || '/snaprecipes-app-icon.png',
          brandLogoSize: brandDefaults?.brandLogoSize || 58,
          ctaButtonText: 'Get the app — free',
          ctaUrl,
          socialHandle,
          perks: [
            { id: 1, title: 'Save from Anywhere', desc: 'Links, photos, TikTok & IG — one tap.' },
            { id: 2, title: 'No Ads, No Rants', desc: 'Just the clean recipe, instantly.' },
            { id: 3, title: 'Quick Extraction', desc: 'Paste a link, get tidy steps.' },
            { id: 4, title: 'Get Started Today!', desc: 'Free to Try,' }
          ],
          sourceUrl: cleanUrl
        };
      }
    }
  } catch (error) {
    console.warn('Scraper error, falling back to heuristic parsing', error);
  }

  // Fallback if network totally down
  const urlPath = new URL(cleanUrl).pathname;
  const slug = urlPath.split('/').filter(Boolean).pop() || 'delicious-easy-recipe';
  const cleanTitle = slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/(Recipe|Easy|Quick|Best|Simple)\s*/gi, '')
    .trim() + ' Recipe';

  return {
    id: `extracted-${Date.now()}`,
    title: cleanTitle.toUpperCase(),
    shortHook: `Quick, golden, and ready in minutes — no complicated kitchen tools needed.`,
    taglineBadge: `• ${brandName.toUpperCase()} · SKIP THE LIFE STORY`,
    heroImage: getFallbackImage(cleanTitle),
    prepTime: '10m',
    cookTime: '15m',
    servings: '4',
    calories: '≈340 cal',
    proteinCallout: 'Fresh homemade',
    highlightBadge: '25 MIN · 4 SERVINGS',
    ingredients: [
      { name: 'Core Base / Flour', amount: '2 cups' },
      { name: 'Fresh Milk or Liquid', amount: '1 cup' },
      { name: 'Sugar / Sweetener', amount: '2 tbsp' },
      { name: 'Oil for cooking', amount: 'As needed' }
    ],
    method: [
      'Mix together ingredients in a medium bowl until smooth.',
      'Heat skillet or pan to medium-high heat.',
      'Cook until golden brown on both sides.',
      'Garnish and serve fresh immediately.'
    ],
    brandName,
    brandSubtitle: 'Save any recipe in one tap.',
    brandPillBadge: 'AD-FREE · NO BLOG RANTS · JUST RECIPES',
    brandLogo: brandDefaults?.brandLogo || '/snaprecipes-app-icon.png',
    brandLogoSize: brandDefaults?.brandLogoSize || 58,
    ctaButtonText: 'Get the app — free',
    ctaUrl,
    socialHandle,
    perks: [
      { id: 1, title: 'Save from Anywhere', desc: 'Links, photos, TikTok & IG — one tap.' },
      { id: 2, title: 'No Ads, No Rants', desc: 'Just the clean recipe, instantly.' },
      { id: 3, title: 'Quick Extraction', desc: 'Paste a link, get tidy steps.' },
      { id: 4, title: 'Get Started Today!', desc: 'Free to Try,' }
    ],
    sourceUrl: cleanUrl
  };
}
