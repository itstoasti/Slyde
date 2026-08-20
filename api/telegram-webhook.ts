import type { VercelRequest, VercelResponse } from '@vercel/node';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

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

// Serverless Recipe Extractor
async function extractRecipeServer(recipeUrl: string) {
  let html = '';
  // Try Jina HTML proxy first (bypasses Cloudflare & Bot blockers)
  try {
    const res = await fetch(`https://r.jina.ai/${recipeUrl}`, {
      headers: { 'X-Return-Format': 'html' }
    });
    if (res.ok) {
      html = await res.text();
    }
  } catch (e) {}

  if (!html || html.length < 500) {
    try {
      const res = await fetch(recipeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (res.ok) html = await res.text();
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

  const title = decodeEntities(recipeObj?.name || 'Delicious Recipe').trim();
  const prepTime = formatIsoDuration(recipeObj?.prepTime || '10m');
  const cookTime = formatIsoDuration(recipeObj?.cookTime || '15m');
  const servings = parseServings(recipeObj?.recipeYield);
  const calories = cleanCalories(recipeObj?.nutrition?.calories);

  const rawIngredients = Array.isArray(recipeObj?.recipeIngredient) ? recipeObj.recipeIngredient : [];
  const ingredients = rawIngredients.slice(0, 12).map((i: string) => {
    const clean = decodeEntities(i).trim();
    return { name: clean, amount: '' };
  });

  let method: string[] = [];
  if (Array.isArray(recipeObj?.recipeInstructions)) {
    method = recipeObj.recipeInstructions.map((s: any) => {
      const txt = typeof s === 'string' ? s : (s.text || '');
      return decodeEntities(txt).replace(/^Step\s*\d+:\s*/i, '').replace(/^\d+\.\s*/, '').replace(/Recipe developed by.*/i, '').trim();
    }).filter(Boolean).slice(0, 6);
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
    taglineBadge: `• ${brandName.toUpperCase()} · SKIP THE LIFE STORY`,
    brandPillBadge: 'AD-FREE · NO BLOG RANTS · JUST RECIPES',
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
async function generateAICaptionServer(recipeData: any) {
  const openRouterKey = process.env.OPENROUTER_API_KEY || '';
  const openRouterModel = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct';
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const brandName = process.env.BRAND_NAME || 'SnapRecipes';
  const ctaUrl = process.env.CTA_URL || 'https://snaprecipes.xyz';
  const brandTag = brandName.replace(/\s+/g, '');

  let hook = `Better than takeout and ready in ${recipeData.cookTime || recipeData.prepTime}. ${recipeData.ingredients.length} ingredients, ${recipeData.method.length} steps. 🍽️`;

  const prompt = `You are a social media chef writing an appetizing 1-sentence viral hook for this recipe: "${recipeData.title}".
Instructions:
- Write ONE complete, punchy sentence describing why this dish is delicious and easy.
- Must end with a period and 🍽️.
- DO NOT end mid-sentence or with a preposition (like "in", "with", "and").
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
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150
        })
      });
      const d = await res.json();
      const txt = d.choices?.[0]?.message?.content?.trim();
      if (txt && txt.length > 15 && !txt.endsWith(' in') && !txt.endsWith(' with') && !txt.endsWith(' and')) {
        hook = txt.replace(/^["']|["']$/g, '').trim();
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
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (txt && txt.length > 15 && !txt.endsWith(' in') && !txt.endsWith(' with') && !txt.endsWith(' and')) {
        hook = txt.replace(/^["']|["']$/g, '').trim();
      }
    } catch (e: any) {}
  }

  const ingList = recipeData.ingredients.map((i: any) => `- ${i.name}${i.amount ? ' (' + i.amount + ')' : ''}`).join('\n');
  const stepsList = recipeData.method.map((s: string, idx: number) => `${idx + 1}. ${s}`).join('\n');
  const firstWord = recipeData.title.split(' ')[0]
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, '') || 'Recipe';

  return `${recipeData.title} — ${hook}

What you need:
${ingList}

How to:
${stepsList}

Prep ${recipeData.prepTime} · Cook ${recipeData.cookTime} · Makes ${recipeData.servings} · ${recipeData.calories}

Save this recipe on ${brandName} — skip the life story, get straight to cooking. Get the app: ${ctaUrl}

#${brandTag} #EasyRecipes #RecipeIdeas #HealthyEating #${firstWord}`.trim();
}

// Render 3 Slides with Serverless Chromium
async function captureSlidesServerless(recipe: any, host: string) {
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

    await page.evaluate((r) => {
      (window as any).__setRecipe(r);
    }, recipe);

    await new Promise(r => setTimeout(r, 800));

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
    return [buf1, buf2, buf3];
  } catch (err) {
    await browser.close();
    throw err;
  }
}

async function sendTelegramMessage(botToken: string, chatId: number | string, messageThreadId: number | undefined, text: string, parseMode: string = 'HTML') {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
        text,
        parse_mode: parseMode
      })
    });
  } catch (e) {}
}

async function sendTelegramAlbum(botToken: string, chatId: number | string, messageThreadId: number | undefined, buffers: (Buffer | Uint8Array)[], title: string) {
  const formData = new FormData();
  formData.append('chat_id', String(chatId));
  if (messageThreadId) {
    formData.append('message_thread_id', String(messageThreadId));
  }
  formData.append('slide_1', new Blob([buffers[0]], { type: 'image/png' }), 'slide-1.png');
  formData.append('slide_2', new Blob([buffers[1]], { type: 'image/png' }), 'slide-2.png');
  formData.append('slide_3', new Blob([buffers[2]], { type: 'image/png' }), 'slide-3.png');

  const media = [
    { type: 'photo', media: 'attach://slide_1', caption: `🍳 <b>${title}</b>`, parse_mode: 'HTML' },
    { type: 'photo', media: 'attach://slide_2' },
    { type: 'photo', media: 'attach://slide_3' }
  ];
  formData.append('media', JSON.stringify(media));

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
    method: 'POST',
    body: formData
  });
  return await res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).send('Slyde Telegram Webhook Endpoint');
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || '8436957773:AAGA7rl6VLtUnAEU2vNTFzv_IhZwA-xSWCk';
  const update = req.body;
  if (!update) {
    return res.status(200).send('OK (no update)');
  }

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

  if (text.startsWith('/start') || text.startsWith('/help')) {
    await sendTelegramMessage(
      botToken,
      chatId,
      messageThreadId,
      `👋 <b>Welcome to Slyde Bot!</b>\n\nSend me <b>any recipe URL</b> (from AllRecipes, NYT Cooking, food blogs) and I will automatically reply with:\n\n1️⃣ <b>Full 3-Slide Carousel Album</b> (Hook, Recipe Card, CTA)\n2️⃣ <b>Viral Social Caption</b> with ingredients, steps, and hashtags!`
    );
    return res.status(200).send('OK');
  }

  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    const recipeUrl = urlMatch[0];

    // 1. Immediate acknowledgment
    await sendTelegramMessage(botToken, chatId, messageThreadId, '👨‍🍳 <b>Extracting recipe & rendering 3 social slides...</b>');

    try {
      const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'slyde-bay.vercel.app';
      const recipe = await extractRecipeServer(recipeUrl);

      // 2. Render all 3 slides using Chromium & send photo album
      try {
        const buffers = await captureSlidesServerless(recipe, host);
        await sendTelegramAlbum(botToken, chatId, messageThreadId, buffers, recipe.title);
      } catch (renderErr: any) {
        console.warn('Chromium render failed in serverless, sending fallback photo:', renderErr.message);
      }

      // 3. Send clean viral caption
      const caption = await generateAICaptionServer(recipe);
      await sendTelegramMessage(botToken, chatId, messageThreadId, caption);

    } catch (err: any) {
      await sendTelegramMessage(botToken, chatId, messageThreadId, `⚠️ Error processing recipe: ${err.message}`);
    }
  }

  return res.status(200).send('OK');
}
