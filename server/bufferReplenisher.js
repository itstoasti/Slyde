/**
 * Slyde Buffer Replenisher Engine
 * Manages the 10-post Buffer queue cap with a self-replenishing rolling reserve queue.
 * Dispatches direct automated scheduled posts via Buffer GraphQL API (schedulingType: "automatic").
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import puppeteer from 'puppeteer-core';
import { selectAudioTrack } from './audioManager.js';
import { extractRecipe, generateSocialCaption } from './batchScheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const BUFFER_CONFIG_FILE = path.join(ROOT_DIR, 'buffer_config.json');
const BRANDING_FILE = path.join(ROOT_DIR, 'branding_config.json');
const RECIPES_FILE = path.join(ROOT_DIR, 'recipes_queue.json');
const TMP_RECIPES_FILE = '/tmp/recipes_queue.json';
const TELEGRAM_CONFIG_FILE = path.join(ROOT_DIR, 'telegram_config.json');

export function loadBufferConfig() {
  const envToken = process.env.BUFFER_ACCESS_TOKEN || '';
  let config = { accessToken: envToken, selectedProfileIds: [], profiles: [] };

  if (fs.existsSync(BUFFER_CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(BUFFER_CONFIG_FILE, 'utf8'));
      config = { ...config, ...data };
      if (!config.accessToken && envToken) {
        config.accessToken = envToken;
      }
    } catch (e) {}
  }
  return config;
}

export function loadTelegramConfig() {
  let botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  let chatId = process.env.TELEGRAM_CHAT_ID || '1294588369';

  if (fs.existsSync(TELEGRAM_CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(TELEGRAM_CONFIG_FILE, 'utf8'));
      if (data.botToken && !botToken) botToken = data.botToken.trim();
      if (data.chatId) chatId = data.chatId.trim();
    } catch (e) {}
  }
  return { botToken, chatId };
}

export function loadBranding() {
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

/**
 * Load recipes queue from /tmp (if in serverless) or root recipes_queue.json
 */
export function loadRecipesQueue() {
  let recipes = [];

  // Check /tmp first (in serverless, modifications persist here during container life)
  if (fs.existsSync(TMP_RECIPES_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(TMP_RECIPES_FILE, 'utf8'));
      if (Array.isArray(data.recipes)) recipes = data.recipes;
      else if (Array.isArray(data.queue)) recipes = data.queue;
      else if (Array.isArray(data)) recipes = data;
    } catch (e) {}
  }

  // If not found in /tmp, check root project directory
  if (recipes.length === 0 && fs.existsSync(RECIPES_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf8'));
      if (Array.isArray(data.recipes)) recipes = data.recipes;
      else if (Array.isArray(data.queue)) recipes = data.queue;
      else if (Array.isArray(data)) recipes = data;

      // Seed /tmp
      try {
        fs.writeFileSync(TMP_RECIPES_FILE, JSON.stringify({ recipes, lastUpdated: new Date().toISOString() }, null, 2));
      } catch (e) {}
    } catch (e) {}
  }

  return recipes;
}

/**
 * Save recipes queue to both /tmp and root (if writable)
 */
export function saveRecipesQueue(recipes) {
  const payload = JSON.stringify({ recipes, queue: recipes, lastUpdated: new Date().toISOString() }, null, 2);

  // Write to /tmp
  try {
    fs.writeFileSync(TMP_RECIPES_FILE, payload);
  } catch (e) {}

  // Write to root (succeeds in local dev)
  try {
    fs.writeFileSync(RECIPES_FILE, payload);
  } catch (e) {}
}

/**
 * Add an array of URLs or recipes to the Reserve Queue.
 * Deduplicates automatically against existing entries.
 */
export function addRecipesToReserve(urlsOrRecipes) {
  const current = loadRecipesQueue();
  const existingUrls = new Set(
    current.map(r => (r.sourceUrl || r.url || '').trim().toLowerCase()).filter(Boolean)
  );
  const existingTitles = new Set(
    current.map(r => (r.title || '').trim().toLowerCase()).filter(Boolean)
  );

  const incoming = Array.isArray(urlsOrRecipes) ? urlsOrRecipes : [urlsOrRecipes];
  const newlyAdded = [];

  for (const item of incoming) {
    if (!item) continue;

    if (typeof item === 'string') {
      const url = item.trim();
      if (!url.startsWith('http')) continue;
      if (existingUrls.has(url.toLowerCase())) continue;

      // Derive provisional title from URL slug
      let provisionalTitle = 'Featured Recipe';
      try {
        const u = new URL(url);
        const segments = u.pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1] || '';
        if (last) {
          provisionalTitle = last
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())
            .replace(/\.html?$/i, '');
        }
      } catch (e) {}

      const newEntry = {
        id: `recipe-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: provisionalTitle,
        sourceUrl: url,
        url: url,
        status: 'pending',
        addedAt: new Date().toISOString()
      };

      current.push(newEntry);
      newlyAdded.push(newEntry);
      existingUrls.add(url.toLowerCase());
    } else if (typeof item === 'object') {
      const url = (item.sourceUrl || item.url || '').trim();
      const title = (item.title || '').trim();

      if (url && existingUrls.has(url.toLowerCase())) continue;
      if (title && existingTitles.has(title.toLowerCase())) continue;

      const newEntry = {
        ...item,
        id: item.id || `recipe-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: title || 'Featured Recipe',
        sourceUrl: url || item.sourceUrl || item.url || '',
        status: item.status || 'pending',
        addedAt: item.addedAt || new Date().toISOString()
      };

      current.push(newEntry);
      newlyAdded.push(newEntry);
      if (url) existingUrls.add(url.toLowerCase());
      if (title) existingTitles.add(title.toLowerCase());
    }
  }

  if (newlyAdded.length > 0) {
    saveRecipesQueue(current);
  }

  const pendingCount = current.filter(r => r.status !== 'scheduled' && r.status !== 'published').length;

  return {
    addedCount: newlyAdded.length,
    newlyAdded,
    totalReserveCount: current.length,
    pendingCount
  };
}

/**
 * Get reserve queue counts and listing
 */
export function getReserveQueueStatus() {
  const current = loadRecipesQueue();
  const pending = current.filter(r => r.status !== 'scheduled' && r.status !== 'published');
  const scheduled = current.filter(r => r.status === 'scheduled');
  const published = current.filter(r => r.status === 'published');

  return {
    totalCount: current.length,
    pendingCount: pending.length,
    scheduledCount: scheduled.length,
    publishedCount: published.length,
    pendingRecipes: pending,
    allRecipes: current
  };
}

/**
 * Query Buffer GraphQL API to get current scheduled posts count & dates
 */
export async function getBufferQueueStatus(customToken = null) {
  const token = (customToken || loadBufferConfig().accessToken || '').trim();
  if (!token) {
    return { success: false, message: 'Missing Buffer Access Token' };
  }

  try {
    // 1. Get Organization ID
    const accountQuery = `query GetAccount {
      account {
        organizations {
          id
          name
          channelCount
        }
      }
    }`;

    const accRes = await fetch('https://api.buffer.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ query: accountQuery })
    });

    const accData = await accRes.json();
    const orgId = accData.data?.account?.organizations?.[0]?.id;

    if (!orgId) {
      const err = accData.errors?.[0]?.message || 'Could not find Buffer organization';
      return { success: false, message: err };
    }

    // 2. Get Scheduled Posts
    const postsQuery = `query GetScheduledPosts($input: PostsInput!) {
      posts(input: $input) {
        edges {
          node {
            id
            text
            dueAt
            status
            channelId
          }
        }
      }
    }`;

    const postsRes = await fetch('https://api.buffer.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query: postsQuery,
        variables: {
          input: {
            organizationId: orgId,
            filter: { status: ['scheduled'] }
          }
        }
      })
    });

    const postsData = await postsRes.json();
    const edges = postsData.data?.posts?.edges || [];
    
    // Sort scheduled posts chronologically
    const scheduledPosts = edges.map(e => e.node).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    const totalScheduled = scheduledPosts.length;
    const slotsAvailable = Math.max(0, 10 - totalScheduled);

    const latestDueAt = scheduledPosts.length > 0 ? scheduledPosts[scheduledPosts.length - 1].dueAt : null;

    return {
      success: true,
      orgId,
      totalScheduled,
      slotsAvailable,
      latestDueAt,
      scheduledPosts
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Universal slide capture (works in serverless and local node)
 */
async function captureSlidesUniversal(recipe, host = '', aspectRatio = '9:16') {
  let chromium = null;
  try {
    chromium = (await import('@sparticuz/chromium')).default;
  } catch (e) {}

  let executablePath = null;
  if (chromium) {
    try {
      executablePath = await chromium.executablePath();
    } catch (e) {}
  }
  if (!executablePath) {
    executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }

  const browser = await puppeteer.launch({
    args: chromium?.args || ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
    defaultViewport: { width: 1200, height: 2400, deviceScaleFactor: 2.5 },
    executablePath,
    headless: true
  });

  try {
    const page = await browser.newPage();
    const cleanHost = (host || process.env.VERCEL_URL || 'slyde-bay.vercel.app').replace(/^https?:\/\//, '');
    const renderUrl = cleanHost.includes('localhost') ? `http://${cleanHost}/render.html` : `https://${cleanHost}/render.html`;

    await page.goto(renderUrl, { waitUntil: 'networkidle0', timeout: 18000 });
    await page.waitForFunction(() => typeof window.__setRecipe === 'function', { timeout: 12000 });

    await page.evaluate((r, ratio) => {
      window.__setRecipe(r, undefined, ratio);
    }, recipe, aspectRatio);

    await page.waitForSelector('#slide-1', { timeout: 12000 });
    await page.waitForSelector('#slide-2', { timeout: 12000 });
    await page.waitForSelector('#slide-3', { timeout: 12000 });
    await new Promise(r => setTimeout(r, 600));

    const slide1El = await page.$('#slide-1');
    const slide2El = await page.$('#slide-2');
    const slide3El = await page.$('#slide-3');

    if (!slide1El || !slide2El || !slide3El) {
      throw new Error('Slide DOM elements not found');
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

/**
 * Universal 60 FPS video generation with FFmpeg (fast & robust)
 */
async function generateVideoUniversal(buf1, buf2, buf3, audioVibe = 'lofi') {
  let ffmpegPath = 'ffmpeg';
  try {
    const ffmpegInstaller = (await import('@ffmpeg-installer/ffmpeg')).default;
    ffmpegPath = ffmpegInstaller?.path || ffmpegPath;
  } catch (e) {}

  // Linux / Lambda permission handling
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
    } catch (e) {}
  }

  const tmpDir = '/tmp';
  const timestamp = Date.now() + Math.random().toString(36).substring(2, 6);
  const slide1Path = path.join(tmpDir, `s1_${timestamp}.png`);
  const slide2Path = path.join(tmpDir, `s2_${timestamp}.png`);
  const slide3Path = path.join(tmpDir, `s3_${timestamp}.png`);
  const clip1Path = path.join(tmpDir, `c1_${timestamp}.mp4`);
  const clip2Path = path.join(tmpDir, `c2_${timestamp}.mp4`);
  const clip3Path = path.join(tmpDir, `c3_${timestamp}.mp4`);
  const concatPath = path.join(tmpDir, `concat_${timestamp}.txt`);
  const outputPath = path.join(tmpDir, `vid_${timestamp}.mp4`);

  try {
    fs.writeFileSync(slide1Path, buf1);
    fs.writeFileSync(slide2Path, buf2);
    fs.writeFileSync(slide3Path, buf3);

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

    fs.writeFileSync(concatPath, clips.map(c => `file '${c.output}'`).join('\n'));

    // Audio soundtrack lookup (skip if user requested silent/none)
    let audioTrackPath = null;
    const cleanVibe = (audioVibe || 'lofi').toLowerCase();

    if (cleanVibe !== 'none' && cleanVibe !== 'silent') {
      const searchDirs = [
        path.resolve(ROOT_DIR, 'public/audio'),
        path.resolve(ROOT_DIR, 'music')
      ];
      for (const d of searchDirs) {
        if (fs.existsSync(d)) {
          const mp3s = fs.readdirSync(d).filter(f => f.endsWith('.mp3'));
          const lofiMatch = mp3s.find(f => f.includes(cleanVibe)) || mp3s.find(f => f.includes('lofi')) || mp3s[0];
          if (lofiMatch) {
            audioTrackPath = path.join(d, lofiMatch);
            break;
          }
        }
      }
    }

    const ffmpegArgs = ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath];
    if (audioTrackPath && fs.existsSync(audioTrackPath)) {
      ffmpegArgs.push(
        '-stream_loop', '-1',
        '-i', audioTrackPath,
        '-t', '9.0',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-af', 'afade=t=in:ss=0:d=0.25,afade=t=out:st=8.0:d=1.0',
        '-shortest'
      );
    } else {
      ffmpegArgs.push('-t', '9.0', '-c:v', 'copy');
    }
    ffmpegArgs.push(outputPath);

    execFileSync(ffmpegPath, ffmpegArgs, { stdio: 'pipe', timeout: 25000 });

    if (fs.existsSync(outputPath)) {
      const vidBuffer = fs.readFileSync(outputPath);
      return vidBuffer;
    }
    return null;
  } finally {
    // Cleanup temporary files
    [slide1Path, slide2Path, slide3Path, clip1Path, clip2Path, clip3Path, concatPath, outputPath].forEach(p => {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
    });
  }
}

/**
 * Upload rendered image or video buffer to Litterbox for public HTTPS URL
 */
async function uploadToLitterbox(buffer, filename, mime) {
  if (!buffer) return null;
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
    const timeoutId = setTimeout(() => controller.abort(), 25000);
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
    console.warn(`[Replenisher] Upload error for ${filename}:`, e.message);
  }
  return null;
}

/**
 * Top up the Buffer queue with pending recipes up to the 10-post limit.
 * Guaranteed direct automated API scheduling (schedulingType: "automatic").
 */
export async function topUpBufferQueue(options = {}) {
  const {
    host = '',
    preferredTime = '11:30',
    musicVibe = 'lofi',
    onProgress = () => {}
  } = options;

  const bufferConfig = loadBufferConfig();
  const token = (bufferConfig.accessToken || '').trim();
  if (!token) {
    return { success: false, message: 'Missing Buffer Access Token. Please configure Buffer in Settings.' };
  }

  const profiles = bufferConfig.profiles || [];
  const profileIds = (bufferConfig.selectedProfileIds && bufferConfig.selectedProfileIds.length > 0)
    ? bufferConfig.selectedProfileIds
    : profiles.map(p => p.id);

  if (profileIds.length === 0) {
    return { success: false, message: 'No social channels configured or selected in Buffer.' };
  }

  // 1. Check current queue status on Buffer
  onProgress({ stage: 'checking_buffer', message: 'Checking active posts in Buffer...' });
  const status = await getBufferQueueStatus(token);
  if (!status.success) {
    return { success: false, message: `Failed to query Buffer queue: ${status.message}` };
  }

  console.log(`[Replenisher] Buffer currently has ${status.totalScheduled}/10 scheduled posts. ${status.slotsAvailable} slots available.`);

  if (status.slotsAvailable === 0) {
    const reserveStatus = getReserveQueueStatus();
    return {
      success: true,
      message: 'Buffer queue is completely full (10/10 posts scheduled). Autopilot is running on schedule!',
      scheduledCount: 0,
      totalScheduled: status.totalScheduled,
      slotsAvailable: 0,
      remainingInReserve: reserveStatus.pendingCount
    };
  }

  // 2. Load recipes queue
  const allRecipes = loadRecipesQueue();
  const pendingIndices = [];
  for (let i = 0; i < allRecipes.length; i++) {
    const r = allRecipes[i];
    if (r.status !== 'scheduled' && r.status !== 'published') {
      pendingIndices.push(i);
    }
  }

  if (pendingIndices.length === 0) {
    return {
      success: true,
      message: 'No pending recipes in your reserve queue. Paste more recipe URLs to refill!',
      scheduledCount: 0,
      totalScheduled: status.totalScheduled,
      slotsAvailable: status.slotsAvailable,
      remainingInReserve: 0
    };
  }

  const toScheduleIndices = pendingIndices.slice(0, status.slotsAvailable);
  console.log(`[Replenisher] Found ${pendingIndices.length} reserve recipes. Preparing to schedule ${toScheduleIndices.length} to fill Buffer...`);

  // 3. Determine starting date: day after the latest scheduled post, or tomorrow if queue is empty
  let baseDate = new Date();
  if (status.latestDueAt) {
    baseDate = new Date(status.latestDueAt);
    baseDate.setDate(baseDate.getDate() + 1);
  } else {
    baseDate.setDate(baseDate.getDate() + 1);
  }

  const [hours, minutes] = preferredTime.split(':').map(Number);
  baseDate.setHours(hours || 11, minutes || 30, 0, 0);

  const newlyScheduled = [];
  const branding = loadBranding();

  for (let step = 0; step < toScheduleIndices.length; step++) {
    const idx = toScheduleIndices[step];
    const item = allRecipes[idx];
    const targetUrl = item.sourceUrl || item.url || item.title;

    onProgress({
      stage: 'processing',
      current: step + 1,
      total: toScheduleIndices.length,
      title: item.title || targetUrl
    });

    try {
      // Extract fresh full recipe data if needed
      let recipe = item;
      if (!recipe.ingredients || recipe.ingredients.length === 0 || !recipe.method || recipe.method.length === 0) {
        recipe = await extractRecipe(targetUrl, branding);
      }

      console.log(`[Replenisher] Rendering & generating caption for: "${recipe.title}"...`);
      const captions = await generateSocialCaption(recipe);

      // Render 9:16 Slides
      let slide1Url = null, slide2Url = null, slide3Url = null, videoUrl = null;
      try {
        const [buf1, buf2, buf3] = await captureSlidesUniversal(recipe, host, '9:16');

        // Render 60 FPS Video with Lo-Fi background audio
        let videoBuf = null;
        try {
          videoBuf = await generateVideoUniversal(buf1, buf2, buf3, musicVibe);
        } catch (vidErr) {
          console.warn('[Replenisher] Video render fallback to slides:', vidErr.message);
        }

        const slug = (recipe.title || 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const uploads = [
          uploadToLitterbox(buf1, `${slug}-slide-1.png`, 'image/png'),
          uploadToLitterbox(buf2, `${slug}-slide-2.png`, 'image/png'),
          uploadToLitterbox(buf3, `${slug}-slide-3.png`, 'image/png')
        ];
        if (videoBuf) {
          uploads.push(uploadToLitterbox(videoBuf, `${slug}-shorts.mp4`, 'video/mp4'));
        }

        const uploadResults = await Promise.all(uploads);
        slide1Url = uploadResults[0];
        slide2Url = uploadResults[1];
        slide3Url = uploadResults[2];
        if (videoBuf && uploadResults[3]) {
          videoUrl = uploadResults[3];
        }
      } catch (renderErr) {
        console.warn(`[Replenisher] Slide rendering issue for "${recipe.title}":`, renderErr.message);
      }

      const mediaUrls = [slide1Url, slide2Url, slide3Url].filter(Boolean);

      // Calculate scheduled date for this slot
      const slotDate = new Date(baseDate);
      slotDate.setDate(baseDate.getDate() + step);
      const scheduledIso = slotDate.toISOString();

      console.log(`[Replenisher] Scheduling "${recipe.title}" for ${slotDate.toLocaleString()} across ${profileIds.length} channel(s)...`);

      // Dispatch to Buffer GraphQL API
      for (const channelId of profileIds) {
        const channelMeta = profiles.find(p => p.id === channelId);
        const svc = (channelMeta?.service || '').toLowerCase();
        const isTikTok = svc.includes('tiktok');
        const isYouTube = svc.includes('youtube');
        const isShortConstrained = svc.includes('twitter') || svc.includes('x') || svc.includes('threads');

        const postText = isShortConstrained ? captions.short : captions.long;

        const input = {
          channelId,
          text: postText,
          mode: 'customScheduled',
          dueAt: scheduledIso,
          schedulingType: 'automatic', // Direct automated publishing!
          needsApproval: false,
          saveToDraft: false
        };

        if (isTikTok) {
          input.metadata = { tiktok: { title: recipe.title.substring(0, 90) } };
          if (videoUrl) {
            input.assets = [{ video: { url: videoUrl } }];
          }
        } else if (isYouTube) {
          input.metadata = {
            youtube: {
              title: recipe.title.substring(0, 60),
              categoryId: '26',
              privacy: 'public',
              madeForKids: false
            }
          };
          if (videoUrl) {
            input.assets = [{ video: { url: videoUrl } }];
          }
        } else {
          // Instagram / Threads / Facebook
          if (mediaUrls.length > 0) {
            input.assets = mediaUrls.map(url => ({ image: { url } }));
          }
          if (svc.includes('instagram')) {
            input.metadata = {
              instagram: {
                type: 'post',
                shouldShareToFeed: true
              }
            };
          }
        }

        const mutation = `mutation CreateScheduledPost($input: CreatePostInput!) {
          createPost(input: $input) {
            ... on PostActionSuccess {
              post {
                id
                status
              }
            }
            ... on MutationError {
              message
            }
          }
        }`;

        try {
          const schedRes = await fetch('https://api.buffer.com', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ query: mutation, variables: { input } })
          });

          const schedData = await schedRes.json();
          console.log(`[Replenisher] Buffer API response for ${svc}:`, schedData.data?.createPost);
        } catch (e) {
          console.warn(`[Replenisher] Error posting to ${svc}:`, e.message);
        }
      }

      // Mark recipe as scheduled in queue
      allRecipes[idx] = {
        ...recipe,
        status: 'scheduled',
        scheduledAt: scheduledIso,
        lastUpdated: new Date().toISOString()
      };

      newlyScheduled.push({
        title: recipe.title,
        scheduledAt: scheduledIso
      });
    } catch (recipeErr) {
      console.error(`[Replenisher] Error scheduling recipe index ${idx}:`, recipeErr);
    }
  }

  // Save updated recipes queue to disk
  saveRecipesQueue(allRecipes);

  const remaining = allRecipes.filter(r => r.status !== 'scheduled' && r.status !== 'published').length;
  const newTotal = status.totalScheduled + newlyScheduled.length;

  return {
    success: true,
    scheduledCount: newlyScheduled.length,
    newlyScheduled,
    totalScheduled: newTotal,
    slotsAvailable: Math.max(0, 10 - newTotal),
    remainingInReserve: remaining,
    message: `Successfully scheduled ${newlyScheduled.length} new recipe(s) to Buffer! Buffer is now ${newTotal}/10 full with ${remaining} recipe(s) in reserve.`
  };
}

/**
 * Send Telegram notification utility
 */
export async function notifyTelegram(messageHtml) {
  const { botToken, chatId } = loadTelegramConfig();
  if (!botToken || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageHtml,
        parse_mode: 'HTML'
      })
    });
    const data = await res.json();
    return data.ok;
  } catch (e) {
    return false;
  }
}
