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
    shortHook: `Better than takeout and ready in ${cookTime || prepTime}. ${ingredients.length} ingredients, ${method.length} steps.`,
    highlightBadge: `${(cookTime || prepTime).toUpperCase()} · ${servings} SERVINGS`,
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

  const ingList = recipeData.ingredients.map((i: any) => `- ${i.name}${i.amount ? ' (' + i.amount + ')' : ''}`).join('\n');
  const stepsList = recipeData.method.map((s: string, idx: number) => `${idx + 1}. ${s}`).join('\n');
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

// Render 3 Slides and 60 FPS Video with Serverless Chromium
async function captureMediaServerless(recipe: any, host: string, includeVideo: boolean = true): Promise<{ slides: (Buffer | Uint8Array)[]; videoBuffer: Buffer | null }> {
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

    let videoBuffer: Buffer | null = null;
    if (includeVideo) {
      try {
        const imgB64List = [buf1.toString('base64'), buf2.toString('base64'), buf3.toString('base64')];

        const videoPage = await browser.newPage();
        await videoPage.setViewport({ width: 1080, height: 1920 });

        const videoBase64 = await videoPage.evaluate(async (b64Images) => {
          const images = await Promise.all(b64Images.map(src => new Promise<HTMLImageElement>(resolve => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = 'data:image/png;base64,' + src;
          })));

          const canvas = document.createElement('canvas');
          canvas.width = 1080;
          canvas.height = 1920;
          document.body.appendChild(canvas);
          const ctx = canvas.getContext('2d', { alpha: false })!;

          // Generate silent audio track for YouTube / iOS audio mixing compatibility
          let audioTracks: MediaStreamTrack[] = [];
          let audioCtx: any = null;
          let osc: any = null;
          try {
            audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const dest = audioCtx.createMediaStreamDestination();
            osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            gain.gain.value = 0.0001; // Silent
            osc.connect(gain);
            gain.connect(dest);
            osc.start();
            audioTracks = dest.stream.getAudioTracks();
          } catch (e) {}

          const canvasStream = canvas.captureStream(30);
          const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioTracks
          ]);

          let mimeType = 'video/webm;codecs=vp8,opus';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
          }

          const recorder = new MediaRecorder(combinedStream, {
            mimeType,
            videoBitsPerSecond: 4500000
          });
          const chunks: Blob[] = [];
          recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

          const done = new Promise<string>(resolve => {
            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: mimeType });
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            };
          });

          const totalDurationMs = 9000;
          const startTime = performance.now();

          recorder.start();

          const interval = setInterval(() => {
            const elapsedMs = performance.now() - startTime;
            if (elapsedMs >= totalDurationMs) {
              clearInterval(interval);
              recorder.stop();
              try { if (osc) osc.stop(); } catch (e) {}
              try { if (audioCtx) audioCtx.close(); } catch (e) {}
              return;
            }

            const elapsedSec = elapsedMs / 1000;

            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 1080, 1920);

            // Hook (0 - 2.5s), Recipe (2.5 - 7.2s), CTA (7.2 - 9.0s)
            if (elapsedSec < 2.1) {
              ctx.drawImage(images[0], 0, 0, 1080, 1920);
            } else if (elapsedSec < 2.5) {
              const progress = (elapsedSec - 2.1) / 0.4;
              const ease = 1 - Math.pow(1 - progress, 3);
              const offsetX = ease * 1080;
              ctx.drawImage(images[0], -offsetX, 0, 1080, 1920);
              ctx.drawImage(images[1], 1080 - offsetX, 0, 1080, 1920);
            } else if (elapsedSec < 6.8) {
              ctx.drawImage(images[1], 0, 0, 1080, 1920);
            } else if (elapsedSec < 7.2) {
              const progress = (elapsedSec - 6.8) / 0.4;
              const ease = 1 - Math.pow(1 - progress, 3);
              const offsetX = ease * 1080;
              ctx.drawImage(images[1], -offsetX, 0, 1080, 1920);
              ctx.drawImage(images[2], 1080 - offsetX, 0, 1080, 1920);
            } else {
              ctx.drawImage(images[2], 0, 0, 1080, 1920);
            }
          }, 33);

          return done;
        }, imgB64List);

        if (videoBase64) {
          const match = videoBase64.match(/^data:video\/[a-zA-Z0-9_-]+;base64,(.+)$/);
          if (match) {
            videoBuffer = Buffer.from(match[1], 'base64');
          }
        }
      } catch (vidErr: any) {
        console.warn('Video generation error in serverless:', vidErr.message);
      }
    }

    await browser.close();
    return {
      slides: [buf1, buf2, buf3],
      videoBuffer
    };
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

  const caption = `🎬 <b>${title}</b>\n\n<i>✨ 9.0s 9:16 Shorts/TikTok video ready! Tap to save to camera roll & add trending audio in the YouTube/TikTok app.</i>`;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).send('Slyde Telegram Webhook Endpoint');
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || '8436957773:AAGA7rl6VLtUnAEU2vNTFzv_IhZwA-xSWCk';
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
      `🎬 <b>Welcome to Slyde Automation Bot!</b>\n\nSend me <b>any recipe URL</b> or use commands:\n\n🎥 <b>/video &lt;url&gt;</b> — 9.0s 9:16 Video (Ready for YouTube Shorts & TikTok)\n📸 <b>/slides &lt;url&gt;</b> — 3-Slide Carousel Album (Instagram & Threads)\n⚡ <b>/all &lt;url&gt;</b> (or paste any URL) — Both Video + 3 Slides + Caption\n📋 <b>/caption &lt;url&gt;</b> — Viral Social Caption only\n\n<i>💡 Tip: Tap and save the video directly to your phone camera roll to add trending sounds in the YouTube Shorts or TikTok app!</i>`
    );
    return res.status(200).send('OK');
  }

  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    const recipeUrl = urlMatch[0];
    const lowerText = text.toLowerCase().trim();

    const isVideoOnly = lowerText.startsWith('/video') || lowerText.startsWith('/short') || lowerText.startsWith('/reel') || lowerText.startsWith('/v ');
    const isSlidesOnly = lowerText.startsWith('/slides') || lowerText.startsWith('/carousel') || lowerText.startsWith('/album') || lowerText.startsWith('/s ');
    const isCaptionOnly = lowerText.startsWith('/caption') || lowerText.startsWith('/c ');

    const modeText = isVideoOnly ? '🎬 9.0s Video' : (isSlidesOnly ? '📸 3 Social Slides' : '⚡ 9.0s Video + 3 Slides');

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
          const media = await captureMediaServerless(recipe, host, needsVideo);

          // Send Video if requested
          if (media.videoBuffer && (isVideoOnly || !isSlidesOnly)) {
            const vidRes = await sendTelegramVideo(botToken, chatId, messageThreadId, media.videoBuffer, recipe.title);
            if (vidRes && !vidRes.ok) {
              console.warn('Telegram sendVideo error:', vidRes.description);
              await sendTelegramMessage(botToken, chatId, messageThreadId, `⚠️ Video delivery note: ${vidRes.description}`);
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
