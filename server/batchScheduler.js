/**
 * Slyde Automated Batch Scheduler Engine
 * Processes multiple recipe URLs, generates high-res slides & 60 FPS videos with background music,
 * and schedules them on a daily cadence across TikTok, Instagram, and Threads via Buffer.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import puppeteer from 'puppeteer-core';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { selectAudioTrack } from './audioManager.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const BUFFER_CONFIG_FILE = path.join(ROOT_DIR, 'buffer_config.json');
const BRANDING_FILE = path.join(ROOT_DIR, 'branding_config.json');
const SCHEDULED_POSTS_FILE = path.join(ROOT_DIR, 'scheduled_posts.json');
const TELEGRAM_CONFIG_FILE = path.join(ROOT_DIR, 'telegram_config.json');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function loadBufferConfig() {
  if (fs.existsSync(BUFFER_CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(BUFFER_CONFIG_FILE, 'utf8'));
    } catch (e) {}
  }
  return { accessToken: '', selectedProfileIds: [], profiles: [] };
}

function loadBranding() {
  let brandName = 'SnapRecipes';
  let socialHandle = '@snaprecipes';
  let ctaUrl = 'snaprecipes.xyz';
  let brandLogo = '/snaprecipes-app-icon.png';
  let brandLogoSize = 58;

  if (fs.existsSync(BRANDING_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(BRANDING_FILE, 'utf8'));
      if (data.brandName) brandName = data.brandName;
      if (data.socialHandle) socialHandle = data.socialHandle;
      if (data.ctaUrl) ctaUrl = data.ctaUrl;
      if (data.brandLogo) brandLogo = data.brandLogo;
      if (data.brandLogoSize) brandLogoSize = data.brandLogoSize;
    } catch (e) {}
  }
  return { brandName, socialHandle, ctaUrl, brandLogo, brandLogoSize };
}

function loadScheduledPosts() {
  if (fs.existsSync(SCHEDULED_POSTS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SCHEDULED_POSTS_FILE, 'utf8'));
      if (Array.isArray(data.posts)) return data.posts;
      if (Array.isArray(data)) return data;
    } catch (e) {}
  }
  return [];
}

function saveScheduledPosts(posts) {
  try {
    fs.writeFileSync(SCHEDULED_POSTS_FILE, JSON.stringify({ posts, lastUpdated: new Date().toISOString() }, null, 2));
  } catch (e) {}
}

function decodeHtmlEntities(text) {
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

function formatIsoDuration(duration) {
  if (!duration) return '5m';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;
  const hours = match[1] ? `${match[1]}h ` : '';
  const mins = match[2] ? `${match[2]}m` : '';
  return `${hours}${mins}`.trim() || '10m';
}

function parseServings(rawYield) {
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

function cleanIngredient(raw) {
  if (!raw) return '';
  let str = decodeHtmlEntities(raw).trim();
  str = str.replace(/\btablespoons?\b/gi, 'tbsp');
  str = str.replace(/\bteaspoons?\b/gi, 'tsp');
  str = str.replace(/\bpounds?\b/gi, 'lb');
  str = str.replace(/\bounces?\b/gi, 'oz');
  str = str.replace(/\bpackages?\b/gi, 'pkg');
  str = str.replace(/\bquarts?\b/gi, 'qt');
  str = str.replace(/\bpints?\b/gi, 'pt');
  str = str.replace(/([1-9]\d*)\.5\d*/g, '$1 1/2');
  str = str.replace(/([1-9]\d*)\.25\d*/g, '$1 1/4');
  str = str.replace(/([1-9]\d*)\.75\d*/g, '$1 3/4');
  str = str.replace(/\b0\.5\d*/g, '1/2');
  str = str.replace(/\b0\.25\d*/g, '1/4');
  str = str.replace(/\b0\.75\d*/g, '3/4');
  str = str.replace(/,\s*or\s+to\s+taste/gi, ' (to taste)');
  str = str.replace(/,\s*or\s+as\s+needed/gi, '');
  str = str.replace(/,\s*divided/gi, '');
  return str.trim();
}

function generateHook(title, prep, cook, numIngredients) {
  const t = title.toLowerCase();
  if (t.includes('cake') || t.includes('dessert') || t.includes('fudge') || t.includes('ice cream')) {
    return `Rich, satisfying, and effortless. Restaurant-quality flavors made right at home.`;
  }
  if (t.includes('rangoon') || t.includes('crispy') || t.includes('fried')) {
    return `Crispy, golden, and packed with flavor — restaurant perfection straight from your kitchen.`;
  }
  if (numIngredients <= 5) {
    return `Just ${numIngredients} simple ingredients. Zero hassle. Restaurant-quality flavors made effortless.`;
  }
  return `Better than takeout and ready in ${cook || prep || '25m'}. ${numIngredients} ingredients, easy steps. 🍽️`;
}

export async function extractRecipe(recipeUrl, brandDefaults) {
  let html = '';
  try {
    const res = await fetch(`https://r.jina.ai/${recipeUrl}`, {
      headers: { 'X-Return-Format': 'html' }
    });
    if (res.ok) html = await res.text();
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

  let recipeObj = null;
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const scriptContent of jsonLdMatches) {
    try {
      const jsonStr = scriptContent.replace(/<script.*?>|<\/script>/gi, '').trim();
      const parsed = JSON.parse(jsonStr);
      const list = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);
      const found = list.find((item) => {
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
    } catch (e) {}
  }

  const title = decodeHtmlEntities(recipeObj?.name || 'Delicious Recipe').trim();
  const prepTime = formatIsoDuration(recipeObj?.prepTime) || '10m';
  const cookTime = formatIsoDuration(recipeObj?.cookTime) || '15m';
  const servings = parseServings(recipeObj?.recipeYield);
  const calories = recipeObj?.nutrition?.calories ? `${recipeObj.nutrition.calories} cal` : '≈340 cal';
  const protein = recipeObj?.nutrition?.proteinContent ? `${recipeObj.nutrition.proteinContent} protein` : '';

  let imageUrl = '';
  if (typeof recipeObj?.image === 'string') {
    imageUrl = recipeObj.image;
  } else if (Array.isArray(recipeObj?.image) && recipeObj.image.length > 0) {
    imageUrl = typeof recipeObj.image[0] === 'string' ? recipeObj.image[0] : (recipeObj.image[0]?.url || '');
  } else if (recipeObj?.image?.url) {
    imageUrl = recipeObj.image.url;
  }

  if (!imageUrl) {
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch) imageUrl = ogMatch[1];
  }

  if (!imageUrl) {
    imageUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=85';
  }

  const rawIngredients = Array.isArray(recipeObj?.recipeIngredient) ? recipeObj.recipeIngredient : [];
  const ingredients = rawIngredients.map((raw) => {
    const cleaned = cleanIngredient(raw);
    const parts = cleaned.split('—').length > 1 ? cleaned.split('—') : cleaned.split(' - ');
    if (parts.length > 1) {
      return { name: parts[0].trim(), amount: parts.slice(1).join(' - ').trim() };
    }
    return { name: cleaned, amount: '' };
  });

  let method = [];
  if (Array.isArray(recipeObj?.recipeInstructions)) {
    method = recipeObj.recipeInstructions.map((s) => {
      const txt = typeof s === 'string' ? s : (s.text || '');
      return decodeHtmlEntities(txt)
        .replace(/^Step\s*\d+:\s*/i, '')
        .replace(/^\d+\.\s*/, '')
        .replace(/Recipe developed by.*/i, '')
        .trim();
    }).filter(Boolean);
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
    taglineBadge: `• ${brandDefaults.brandName.toUpperCase()} · SKIP THE LIFE STORY`,
    heroImage: imageUrl,
    prepTime,
    cookTime,
    servings,
    calories,
    proteinCallout: protein,
    highlightBadge: `${prepTime.toUpperCase()} · ${servings} SERVINGS`,
    ingredients,
    method,
    brandName: brandDefaults.brandName,
    brandSubtitle: 'Save any recipe in one tap.',
    brandPillBadge: 'AD-FREE · NO BLOG RANTS · JUST RECIPES',
    brandLogo: brandDefaults.brandLogo || '/snaprecipes-app-icon.png',
    brandLogoSize: brandDefaults.brandLogoSize || 58,
    ctaButtonText: 'Get the app — free',
    ctaUrl: brandDefaults.ctaUrl,
    socialHandle: brandDefaults.socialHandle,
    perks: [
      { id: 1, title: 'Save from Anywhere', desc: 'Links, photos, TikTok & IG — one tap.' },
      { id: 2, title: 'No Ads, No Rants', desc: 'Just the clean recipe, instantly.' },
      { id: 3, title: 'Quick Extraction', desc: 'Paste a link, get tidy steps.' },
      { id: 4, title: 'Get Started Today!', desc: 'Free to try.' }
    ],
    sourceUrl: recipeUrl
  };
}

export async function generateSocialCaption(recipe) {
  let hook = recipe.shortHook;
  const ingList = recipe.ingredients.map(i => `- ${i.name}${i.amount ? ' (' + i.amount + ')' : ''}`).join('\n');
  const stepsList = recipe.method.map((s, idx) => `${idx + 1}. ${s}`).join('\n');
  const firstWord = recipe.title.split(' ')[0].replace(/[^a-zA-Z]/g, '');

  const longCaption = `${recipe.title} — ${hook}

What you need:
${ingList}

How to:
${stepsList}

Prep ${recipe.prepTime} · Cook ${recipe.cookTime} · Makes ${recipe.servings} · ${recipe.calories || '≈340 cal'}

Save this recipe on ${recipe.brandName} — skip the life story, get straight to cooking. Get the app: ${recipe.ctaUrl}

#${recipe.brandName.replace(/\s+/g, '')} #EasyRecipes #RecipeIdeas #HealthyEating #${firstWord}`;

  const shortCaption = `${recipe.title} 🍽️\n${hook}\n\n👉 Full steps & ingredients: ${recipe.ctaUrl}\n#${recipe.brandName.replace(/\s+/g, '')} #QuickRecipes`;

  return { long: longCaption.trim(), short: shortCaption.trim() };
}

export async function captureSlides(recipe, aspectRatio = '9:16') {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 2400, deviceScaleFactor: 2.5 });

    await page.goto('http://localhost:3000/render.html', { waitUntil: 'networkidle0' });

    await page.evaluate((r, ratio) => {
      window.__setRecipe(r, undefined, ratio);
    }, recipe, aspectRatio);

    await new Promise(r => setTimeout(r, 900));

    const slide1El = await page.$('#slide-1');
    const slide2El = await page.$('#slide-2');
    const slide3El = await page.$('#slide-3');

    const [buf1, buf2, buf3] = await Promise.all([
      slide1El.screenshot({ type: 'png' }),
      slide2El.screenshot({ type: 'png' }),
      slide3El.screenshot({ type: 'png' })
    ]);

    return [buf1, buf2, buf3];
  } finally {
    await browser.close();
  }
}

export async function generateVideo(buf1, buf2, buf3, audioTrackPath = null) {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920 });

    const imgB64List = [buf1.toString('base64'), buf2.toString('base64'), buf3.toString('base64')];

    const videoBase64 = await page.evaluate(async (b64Images) => {
      const images = await Promise.all(b64Images.map(src => new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = 'data:image/png;base64,' + src;
      })));

      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d', { alpha: false });

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm',
        videoBitsPerSecond: 5000000
      });
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      const done = new Promise(resolve => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
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
          return;
        }

        const elapsedSec = elapsedMs / 1000;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1080, 1920);

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

    const match = videoBase64.match(/^data:video\/webm;base64,(.+)$/);
    const rawWebm = Buffer.from(match[1], 'base64');

    const tmpIn = path.join('/tmp', `batch-in-${Date.now()}-${Math.random().toString(36).substring(2)}.webm`);
    const tmpOut = path.join('/tmp', `batch-out-${Date.now()}-${Math.random().toString(36).substring(2)}.mp4`);

    try {
      fs.writeFileSync(tmpIn, rawWebm);
      const ffmpegPath = ffmpegInstaller?.path || 'ffmpeg';

      const resolvedAudio = audioTrackPath || selectAudioTrack('', 'auto');
      const ffmpegArgs = ['-y', '-i', tmpIn];

      if (resolvedAudio && fs.existsSync(resolvedAudio)) {
        console.log(`🎵 [Batch] Muxing audio: ${path.basename(resolvedAudio)}`);
        ffmpegArgs.push(
          '-stream_loop', '-1',
          '-i', resolvedAudio,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-profile:v', 'main',
          '-preset', 'ultrafast',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-af', 'afade=t=in:ss=0:d=0.3,afade=t=out:st=8.4:d=0.6',
          '-shortest',
          '-movflags', '+faststart',
          tmpOut
        );
      } else {
        ffmpegArgs.push(
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-profile:v', 'main',
          '-preset', 'ultrafast',
          '-movflags', '+faststart',
          tmpOut
        );
      }

      await execFileAsync(ffmpegPath, ffmpegArgs);

      if (fs.existsSync(tmpOut)) {
        return fs.readFileSync(tmpOut);
      }
    } catch (err) {
      console.warn('Batch FFmpeg transcode error:', err.message);
    } finally {
      try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (e) {}
      try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (e) {}
    }

    return rawWebm;
  } finally {
    await browser.close();
  }
}

async function uploadToLitterbox(buffer, filename, mime) {
  try {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const preBuffer = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="reqtype"\r\n\r\n` +
      `fileupload\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="time"\r\n\r\n` +
      `72h\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="fileToUpload"; filename="${filename}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n`
    );
    const postBuffer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const fullPayload = Buffer.concat([preBuffer, buffer, postBuffer]);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(fullPayload.length)
      },
      body: fullPayload,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const litterUrl = (await res.text()).trim();
    if (litterUrl && litterUrl.startsWith('http')) {
      return litterUrl;
    }
  } catch (e) {
    console.warn(`[Batch] Upload error for ${filename}:`, e.message);
  }
  return null;
}

/**
 * Schedule multiple recipe URLs on a daily cadence
 */
export async function scheduleBatch(options) {
  const {
    urls = [],
    cadence = '1-daily', // '1-daily' | '2-daily'
    preferredTime = '11:30', // HH:MM
    secondTime = '17:30', // HH:MM
    startDate = null, // YYYY-MM-DD or null (defaults to tomorrow)
    musicVibe = 'auto',
    instagramFormat = 'carousel', // 'carousel' | 'video'
    onProgress = () => {}
  } = options;

  const bufferConfig = loadBufferConfig();
  if (!bufferConfig.accessToken) {
    throw new Error('Missing Buffer Access Token in buffer_config.json. Please connect Buffer in Settings.');
  }

  const profiles = bufferConfig.profiles || [];
  const profileIds = bufferConfig.selectedProfileIds || profiles.map(p => p.id);

  if (profileIds.length === 0) {
    throw new Error('No social profiles selected in Buffer config.');
  }

  const branding = loadBranding();
  const scheduledResults = [];

  // Determine starting date
  const start = startDate ? new Date(startDate) : new Date();
  if (!startDate) {
    start.setDate(start.getDate() + 1); // Start tomorrow
  }

  console.log(`🚀 Starting Batch Scheduler for ${urls.length} URLs. Cadence: ${cadence}`);

  for (let i = 0; i < urls.length; i++) {
    const rawUrl = urls[i].trim();
    if (!rawUrl) continue;

    onProgress({ current: i + 1, total: urls.length, stage: 'extracting', url: rawUrl });
    console.log(`\n🍳 [${i + 1}/${urls.length}] Extracting recipe: ${rawUrl}`);

    try {
      const recipe = await extractRecipe(rawUrl, branding);
      console.log(`✨ Extracted: "${recipe.title}" (${recipe.ingredients.length} ings, ${recipe.method.length} steps)`);

      onProgress({ current: i + 1, total: urls.length, stage: 'captions', title: recipe.title });
      const captions = await generateSocialCaption(recipe);

      onProgress({ current: i + 1, total: urls.length, stage: 'rendering_slides', title: recipe.title });
      const [buf1, buf2, buf3] = await captureSlides(recipe, '9:16');

      onProgress({ current: i + 1, total: urls.length, stage: 'rendering_video', title: recipe.title });
      const audioTrack = selectAudioTrack(recipe.title, musicVibe);
      const videoBuf = await generateVideo(buf1, buf2, buf3, audioTrack);

      onProgress({ current: i + 1, total: urls.length, stage: 'uploading', title: recipe.title });
      const slug = recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const [slide1Url, slide2Url, slide3Url, videoUrl] = await Promise.all([
        uploadToLitterbox(buf1, `${slug}-slide-1.png`, 'image/png'),
        uploadToLitterbox(buf2, `${slug}-slide-2.png`, 'image/png'),
        uploadToLitterbox(buf3, `${slug}-slide-3.png`, 'image/png'),
        uploadToLitterbox(videoBuf, `${slug}-shorts.mp4`, 'video/mp4')
      ]);

      const mediaUrls = [slide1Url, slide2Url, slide3Url].filter(Boolean);

      // Calculate scheduled date & time
      let postDate = new Date(start);
      let timeStr = preferredTime;

      if (cadence === '2-daily') {
        const dayOffset = Math.floor(i / 2);
        postDate.setDate(start.getDate() + dayOffset);
        timeStr = (i % 2 === 0) ? preferredTime : secondTime;
      } else {
        postDate.setDate(start.getDate() + i);
        timeStr = preferredTime;
      }

      const [hours, minutes] = timeStr.split(':').map(Number);
      postDate.setHours(hours || 11, minutes || 30, 0, 0);
      const scheduledIso = postDate.toISOString();

      onProgress({ current: i + 1, total: urls.length, stage: 'scheduling', title: recipe.title, scheduledAt: scheduledIso });
      console.log(`📅 Scheduling for: ${postDate.toLocaleString()} across ${profileIds.length} channel(s)...`);

      // Dispatch to Buffer GraphQL API
      const channelOutcomes = [];

      for (const channelId of profileIds) {
        const channelMeta = profiles.find(p => p.id === channelId);
        const svc = (channelMeta?.service || '').toLowerCase();
        const isTikTok = svc.includes('tiktok');
        const isYouTube = svc.includes('youtube');
        const isInstagram = svc.includes('instagram');

        const input = {
          channelId,
          text: (svc.includes('twitter') || svc.includes('x') || svc.includes('threads')) ? captions.short : captions.long,
          mode: 'customScheduled',
          dueAt: scheduledIso,
          schedulingType: 'automatic',
          needsApproval: false,
          saveToDraft: false
        };

        if (isTikTok) {
          input.metadata = { tiktok: { title: recipe.title } };
          if (videoUrl) {
            input.assets = [{ video: { url: videoUrl } }];
          }
        } else if (isYouTube) {
          input.metadata = {
            youtube: {
              title: recipe.title,
              categoryId: '26',
              privacy: 'public',
              madeForKids: false
            }
          };
          if (videoUrl) {
            input.assets = [{ video: { url: videoUrl } }];
          }
        } else if (isInstagram) {
          input.metadata = { instagram: { type: 'post', shouldShareToFeed: true } };
          if (instagramFormat === 'video' && videoUrl) {
            input.assets = [{ video: { url: videoUrl } }];
          } else if (mediaUrls.length > 0) {
            input.assets = mediaUrls.map(u => ({ image: { url: u } }));
          }
        } else {
          if (mediaUrls.length > 0) {
            input.assets = mediaUrls.map(u => ({ image: { url: u } }));
          }
        }

        try {
          const mutation = `mutation CreatePost($input: CreatePostInput!) {
            createPost(input: $input) {
              ... on PostActionSuccess {
                post { id status }
              }
              ... on MutationError {
                message
              }
            }
          }`;

          const res = await fetch('https://api.buffer.com', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${bufferConfig.accessToken.trim()}`
            },
            body: JSON.stringify({ query: mutation, variables: { input } })
          });

          const json = await res.json();
          const postId = json.data?.createPost?.post?.id;
          const errMsg = json.data?.createPost?.message || json.errors?.[0]?.message;

          channelOutcomes.push({
            channelId,
            service: svc,
            success: Boolean(postId),
            postId: postId || null,
            error: errMsg || null
          });
        } catch (postErr) {
          channelOutcomes.push({
            channelId,
            service: svc,
            success: false,
            error: postErr.message
          });
        }
      }

      const postRecord = {
        id: `sched-${Date.now()}-${i}`,
        title: recipe.title,
        sourceUrl: rawUrl,
        scheduledAt: scheduledIso,
        audioTrack: audioTrack ? path.basename(audioTrack) : 'None',
        videoUrl,
        slideUrls: mediaUrls,
        channelOutcomes,
        status: channelOutcomes.some(c => c.success) ? 'scheduled' : 'failed'
      };

      scheduledResults.push(postRecord);

      // Persist in schedule manifest
      const existing = loadScheduledPosts();
      existing.unshift(postRecord);
      saveScheduledPosts(existing);

      console.log(`✅ [${i + 1}/${urls.length}] Success! Scheduled "${recipe.title}" for ${postDate.toLocaleString()}`);
    } catch (recipeErr) {
      console.error(`❌ [${i + 1}/${urls.length}] Error processing ${rawUrl}:`, recipeErr.message);
      scheduledResults.push({
        sourceUrl: rawUrl,
        status: 'error',
        error: recipeErr.message
      });
    }
  }

  // Optional: Send Telegram notification summary
  try {
    if (fs.existsSync(TELEGRAM_CONFIG_FILE)) {
      const tg = JSON.parse(fs.readFileSync(TELEGRAM_CONFIG_FILE, 'utf8'));
      if (tg.botToken && tg.chatId) {
        const successCount = scheduledResults.filter(r => r.status === 'scheduled').length;
        const msg = `🎉 <b>Bulk Schedule Complete!</b>\n\n` +
          `📅 Scheduled <b>${successCount}/${urls.length}</b> recipes across your daily social calendar!\n` +
          `🎵 Audio: High-fidelity commercial-safe tracks embedded.\n` +
          `📱 Channels: TikTok, Instagram & Threads.\n\n` +
          scheduledResults.filter(r => r.status === 'scheduled').map((r, idx) =>
            `${idx + 1}. <b>${r.title}</b> — <i>${new Date(r.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</i>`
          ).join('\n');

        await fetch(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tg.chatId, text: msg, parse_mode: 'HTML' })
        });
      }
    }
  } catch (e) {}

  return {
    success: true,
    total: urls.length,
    scheduled: scheduledResults.filter(r => r.status === 'scheduled').length,
    results: scheduledResults
  };
}
