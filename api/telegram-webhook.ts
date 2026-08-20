import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  const prepTime = recipeObj?.prepTime || '10m';
  const cookTime = recipeObj?.cookTime || '15m';
  const servings = recipeObj?.recipeYield ? String(recipeObj.recipeYield).replace(/\D+/g, '') : '4';
  const calories = recipeObj?.nutrition?.calories ? `${recipeObj.nutrition.calories} cal` : 'N/A';

  const rawIngredients = Array.isArray(recipeObj?.recipeIngredient) ? recipeObj.recipeIngredient : [];
  const ingredients = rawIngredients.slice(0, 10).map((i: string) => decodeEntities(i).trim());

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

  return {
    title,
    prepTime,
    cookTime,
    servings,
    calories,
    ingredients,
    method,
    imageUrl
  };
}

// Generate Social Media Caption with Gemini AI
async function generateGeminiCaptionServer(recipeData: any) {
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const brandName = process.env.BRAND_NAME || 'SnapRecipes';
  const ctaUrl = process.env.CTA_URL || 'https://snaprecipes.xyz';
  const brandTag = brandName.replace(/\s+/g, '');

  let hook = `Better than takeout and ready in ${recipeData.cookTime || recipeData.prepTime}. ${recipeData.ingredients.length} ingredients, ${recipeData.method.length} steps. 🍽️`;

  if (geminiKey) {
    try {
      const prompt = `Write a punchy, viral 1-sentence social media hook for this recipe: "${recipeData.title}".
Mention time (${recipeData.cookTime || recipeData.prepTime}), ${recipeData.ingredients.length} ingredients, and ${recipeData.method.length} steps.
Example: "Better than takeout and ready in 30 minutes. 7 ingredients, 5 steps, 30 min. 🍽️"
Return ONLY the 1-sentence hook ending with 🍽️.`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
        })
      });
      const d = await res.json();
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (txt && txt.length > 8) {
        hook = txt.replace(/^["']|["']$/g, '').trim();
      }
    } catch (e: any) {
      console.warn('Gemini hook generation failed, using template', e.message);
    }
  }

  const ingList = recipeData.ingredients.map((i: string) => `- ${i}`).join('\n');
  const stepsList = recipeData.method.map((s: string, idx: number) => `${idx + 1}. ${s}`).join('\n');
  const firstWord = recipeData.title.split(' ')[0].replace(/[^a-zA-Z]/g, '');

  return `${recipeData.title} — ${hook}

What you need:
${ingList}

How to:
${stepsList}

Prep ${recipeData.prepTime} · Cook ${recipeData.cookTime} · Makes ${recipeData.servings} · cal ${recipeData.calories || 'N/A'}

Save this recipe on ${brandName} — skip the life story, get straight to cooking. Get the app: ${ctaUrl}

#${brandTag} #EasyRecipes #RecipeIdeas #HealthyEating #${firstWord}`.trim();
}

async function sendTelegramMessage(botToken: string, chatId: number | string, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const d = await res.json();
    if (!d.ok) {
      console.warn('Telegram sendMessage warning:', d.description);
    }
  } catch (e: any) {
    console.warn('Telegram sendMessage network error:', e.message);
  }
}

async function sendTelegramPhoto(botToken: string, chatId: number | string, photoUrl: string, caption: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption.substring(0, 1020) })
    });
    const d = await res.json();
    if (!d.ok) {
      await sendTelegramMessage(botToken, chatId, caption);
    }
  } catch (e) {
    await sendTelegramMessage(botToken, chatId, caption);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).send('Slyde Telegram Webhook Endpoint');
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN environment variable not set' });
  }

  const update = req.body;
  if (!update) {
    return res.status(400).send('No update body');
  }

  const msg = update.message || update.channel_post || update.edited_message || update.edited_channel_post;
  if (!msg) {
    return res.status(200).send('OK (no message)');
  }

  const text: string = msg.text || msg.caption || '';
  const chatId = msg.chat?.id;

  if (!chatId || !text) {
    return res.status(200).send('OK (no text or chatId)');
  }

  if (text.startsWith('/start') || text.startsWith('/help')) {
    await sendTelegramMessage(
      botToken,
      chatId,
      `👋 *Welcome to Slyde AI Recipe Bot!*\n\nSend me *any recipe URL* (e.g. from AllRecipes, NYT Cooking, food blogs) and I will extract the recipe photo and generate your viral social media caption with Gemini AI!`
    );
    return res.status(200).send('OK');
  }

  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    const recipeUrl = urlMatch[0];

    // 1. Immediate acknowledgment
    await sendTelegramMessage(botToken, chatId, '👨‍🍳 *Extracting recipe & crafting social caption with Gemini AI...*');

    try {
      const parsed = await extractRecipeServer(recipeUrl);
      const caption = await generateGeminiCaptionServer(parsed);
      await sendTelegramMessage(botToken, chatId, caption);
    } catch (err: any) {
      await sendTelegramMessage(botToken, chatId, `⚠️ Error processing recipe: ${err.message}`);
    }
  }

  return res.status(200).send('OK');
}
