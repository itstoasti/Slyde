import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Vite Plugin to sync Telegram credentials and proxy external recipe images (bypasses hotlink protection & CORS)
function slydeServerPlugin() {
  const configPath = path.resolve(__dirname, 'telegram_config.json');

  return {
    name: 'slyde-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // 1. Sync Telegram Config
        if (req.url === '/api/save-telegram-config' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Saved to disk' }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: e.message }));
            }
          });
          return;
        }

        if (req.url === '/api/get-telegram-config' && req.method === 'GET') {
          const defaultTelegram = {
            botToken: process.env.TELEGRAM_BOT_TOKEN || '',
            chatId: process.env.TELEGRAM_CHAT_ID || '1294588369',
            includeCaption: true,
            sendAsAlbum: true,
            inboundListenerEnabled: true
          };
          if (fs.existsSync(configPath)) {
            try {
              const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                ...defaultTelegram,
                ...data,
                botToken: data.botToken || defaultTelegram.botToken,
                chatId: data.chatId || defaultTelegram.chatId
              }));
              return;
            } catch (e) {}
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(defaultTelegram));
          return;
        }

        if (req.url === '/api/publish-telegram' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { slides = [], title = 'Recipe Carousel', caption, botToken: clientToken, chatId: clientChatId, messageThreadId } = JSON.parse(body);
              const botToken = (clientToken && clientToken.trim()) || process.env.TELEGRAM_BOT_TOKEN;
              const rawChat = (clientChatId && clientChatId.trim()) || '';
              const chatId = (rawChat && !rawChat.includes('Claaaaaark')) ? rawChat : (process.env.TELEGRAM_CHAT_ID || '1294588369');

              const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
              const parts = [];

              parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`));
              if (messageThreadId) {
                parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="message_thread_id"\r\n\r\n${messageThreadId}\r\n`));
              }

              const shortAlbumHook = `🍳 <b>${title}</b>`;
              const mediaList = slides.map((_, idx) => ({
                type: 'photo',
                media: `attach://slide_${idx + 1}`,
                caption: idx === 0 ? shortAlbumHook : undefined,
                parse_mode: 'HTML'
              }));

              parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media"\r\n\r\n${JSON.stringify(mediaList)}\r\n`));

              for (let i = 0; i < slides.length; i++) {
                let rawBase64 = slides[i];
                if (typeof rawBase64 === 'string' && rawBase64.includes('base64,')) {
                  rawBase64 = rawBase64.split('base64,')[1];
                }
                const buffer = Buffer.from(rawBase64, 'base64');
                parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="slide_${i + 1}"; filename="slide-${i + 1}.png"\r\nContent-Type: image/png\r\n\r\n`));
                parts.push(buffer);
                parts.push(Buffer.from(`\r\n`));
              }
              parts.push(Buffer.from(`--${boundary}--\r\n`));

              const reqBody = Buffer.concat(parts);
              const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
                method: 'POST',
                headers: {
                  'Content-Type': `multipart/form-data; boundary=${boundary}`,
                  'Content-Length': String(reqBody.length)
                },
                body: reqBody
              });

              const telegramData = await telegramRes.json();
              res.setHeader('Content-Type', 'application/json');
              if (telegramData.ok) {
                if (caption && caption.trim()) {
                  try {
                    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        chat_id: chatId,
                        ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
                        text: caption
                      })
                    });
                  } catch (captionErr) {}
                }
                res.end(JSON.stringify({ success: true, message: `3-Slide carousel & AI caption published to ${chatId}! 🚀` }));
              } else {
                let msg = telegramData.description || 'Telegram API rejected media';
                if (msg.includes("bot can't send messages to the bot") || msg.includes('chat not found')) {
                  msg = `Cannot send to "${chatId}" (bots cannot message themselves). In Settings, enter your personal numeric User ID (message /start to @Claaaaaarkbot to see it) or your Channel username (e.g. @mychannel).`;
                }
                res.end(JSON.stringify({ success: false, message: msg }));
              }
            } catch (e) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, message: e.message }));
            }
          });
          return;
        }

        // 1b. Sync AI Config (Gemini & OpenRouter)
        const aiConfigPath = path.resolve(__dirname, 'ai_config.json');
        const geminiConfigPath = path.resolve(__dirname, 'gemini_config.json');

        if (req.url === '/api/save-ai-config' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              fs.writeFileSync(aiConfigPath, JSON.stringify(parsed, null, 2), 'utf-8');
              if (parsed.geminiApiKey) {
                fs.writeFileSync(geminiConfigPath, JSON.stringify({ apiKey: parsed.geminiApiKey }, null, 2), 'utf-8');
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'AI configuration saved' }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: e.message }));
            }
          });
          return;
        }

        if (req.url === '/api/get-ai-config' && req.method === 'GET') {
          if (fs.existsSync(aiConfigPath)) {
            try {
              const data = fs.readFileSync(aiConfigPath, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(data);
              return;
            } catch (e) {}
          }
          if (fs.existsSync(geminiConfigPath)) {
            try {
              const data = JSON.parse(fs.readFileSync(geminiConfigPath, 'utf-8'));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ provider: 'gemini', geminiApiKey: data.apiKey || '', geminiModel: 'gemini-2.5-flash', openRouterApiKey: '', openRouterModel: 'meta-llama/llama-3.3-70b-instruct' }));
              return;
            } catch (e) {}
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ provider: 'gemini', geminiApiKey: '', geminiModel: 'gemini-2.5-flash', openRouterApiKey: '', openRouterModel: 'meta-llama/llama-3.3-70b-instruct' }));
          return;
        }

        if (req.url === '/api/save-gemini-config' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              fs.writeFileSync(geminiConfigPath, JSON.stringify(parsed, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Gemini key saved to disk' }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: e.message }));
            }
          });
          return;
        }

        if (req.url === '/api/get-gemini-config' && req.method === 'GET') {
          if (fs.existsSync(geminiConfigPath)) {
            try {
              const data = fs.readFileSync(geminiConfigPath, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(data);
              return;
            } catch (e) {}
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ apiKey: '' }));
          return;
        }

        // 1c. Sync Buffer Config & Proxy
        const bufferConfigPath = path.resolve(__dirname, 'buffer_config.json');
        if (req.url === '/api/save-buffer-config' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              fs.writeFileSync(bufferConfigPath, JSON.stringify(parsed, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Buffer config saved' }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: e.message }));
            }
          });
          return;
        }

        if (req.url === '/api/get-buffer-config' && req.method === 'GET') {
          if (fs.existsSync(bufferConfigPath)) {
            try {
              const data = fs.readFileSync(bufferConfigPath, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(data);
              return;
            } catch (e) {}
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ accessToken: '', selectedProfileIds: [] }));
          return;
        }
        // 1d. Sync Branding Defaults (Brand Name, App Logo, Size, CTA)
        const brandingConfigPath = path.resolve(__dirname, 'branding_config.json');
        if (req.url === '/api/save-branding-defaults' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              fs.writeFileSync(brandingConfigPath, JSON.stringify(parsed, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Branding config saved' }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: e.message }));
            }
          });
          return;
        }

        if (req.url === '/api/get-branding-defaults' && req.method === 'GET') {
          if (fs.existsSync(brandingConfigPath)) {
            try {
              const data = fs.readFileSync(brandingConfigPath, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(data);
              return;
            } catch (e) {}
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ brandName: 'SnapRecipes', socialHandle: '@snaprecipes', ctaUrl: 'snaprecipes.xyz', brandLogo: '/snaprecipes-app-icon.png', brandLogoSize: 58 }));
          return;
        }

        // 1e. Sync Recipes Queue (Auto-Save Recipes)
        const recipesQueuePath = path.resolve(__dirname, 'recipes_queue.json');
        if (req.url === '/api/save-recipes-queue' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              fs.writeFileSync(recipesQueuePath, JSON.stringify(parsed, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Recipes queue saved' }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: e.message }));
            }
          });
          return;
        }

        if (req.url === '/api/get-recipes-queue' && req.method === 'GET') {
          if (fs.existsSync(recipesQueuePath)) {
            try {
              const data = fs.readFileSync(recipesQueuePath, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(data);
              return;
            } catch (e) {}
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ recipes: [] }));
          return;
        }

        // Buffer API Proxy (handles GraphQL & REST with CORS support)
        if (req.url?.startsWith('/api/buffer-proxy') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { action, token, profileIds = [], channels = [], caption, shortCaption, longCaption, title, mediaUrl, mediaUrls = [], scheduledAt, scheduleMode = 'queue' } = JSON.parse(body);
              const cleanToken = (token || '').trim();

              if (!cleanToken) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, message: 'Missing Buffer Access Token' }));
                return;
              }

              if (action === 'get_profiles') {
                // 1. Modern Buffer GraphQL API (Official)
                try {
                  const accountQuery = `query GetAccount {
                    account {
                      id
                      name
                      organizations {
                        id
                        name
                        channelCount
                      }
                    }
                  }`;

                  const accountRes = await fetch('https://api.buffer.com', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${cleanToken}`
                    },
                    body: JSON.stringify({ query: accountQuery })
                  });

                  const accountData = await accountRes.json();
                  const orgs = accountData.data?.account?.organizations || [];

                  if (orgs.length > 0) {
                    const allChannels: any[] = [];
                    for (const org of orgs) {
                      const chQuery = `query GetChannels($input: ChannelsInput!) {
                        channels(input: $input) {
                          id
                          name
                          displayName
                          service
                          avatar
                        }
                      }`;

                      const chRes = await fetch('https://api.buffer.com', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${cleanToken}`
                        },
                        body: JSON.stringify({
                          query: chQuery,
                          variables: { input: { organizationId: org.id } }
                        })
                      });

                      const chData = await chRes.json();
                      const list = chData.data?.channels || [];
                      for (const ch of list) {
                        allChannels.push({
                          id: ch.id,
                          formatted_username: ch.displayName || ch.name,
                          service: ch.service,
                          avatar: ch.avatar
                        });
                      }
                    }

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true, profiles: allChannels }));
                    return;
                  }

                  if (accountData.errors && accountData.errors.length > 0) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, message: accountData.errors[0].message }));
                    return;
                  }
                } catch (e: any) {
                  console.warn('Buffer GraphQL error', e);
                }

                // 2. Legacy REST Fallback
                try {
                  const restRes = await fetch('https://api.bufferapp.com/1/profiles.json', {
                    headers: { 'Authorization': `Bearer ${cleanToken}` }
                  });
                  const restData = await restRes.json();
                  if (Array.isArray(restData)) {
                    const channels = restData.map((p: any) => ({
                      id: p.id,
                      formatted_username: p.formatted_username || p.service_username || p.service,
                      service: p.service,
                      avatar: p.avatar
                    }));
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true, profiles: channels }));
                    return;
                  }
                } catch (e) {}

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, message: 'Invalid Buffer token. Please verify your token in your Buffer developer dashboard.' }));
                return;
              }

              if (action === 'create_post') {
                // 1. Pre-resolve public media assets ONCE in parallel before the channel loop
                const resolvePublicImageUrl = async (rawUrl?: string, index: number = 0): Promise<string | null> => {
                  if (!rawUrl || typeof rawUrl !== 'string') return null;
                  const trimmed = rawUrl.trim();
                  if (!trimmed) return null;

                  // If base64 data URI, upload to temporary public image host with wsrv wrapper
                  if (trimmed.startsWith('data:image/')) {
                    try {
                      const match = trimmed.match(/^data:image\/(\w+);base64,(.+)$/);
                      const ext = match ? (match[1] === 'jpeg' ? 'jpg' : match[1]) : 'png';
                      const b64Data = match ? match[2] : trimmed;
                      const buffer = Buffer.from(b64Data, 'base64');
                      const formData = new FormData();
                      const blob = new Blob([buffer], { type: `image/${ext}` });
                      formData.append('reqtype', 'fileupload');
                      formData.append('time', '72h');
                      formData.append('fileToUpload', blob, `slide-${index + 1}.${ext}`);

                      const controller = new AbortController();
                      const timeoutId = setTimeout(() => controller.abort(), 8000);
                      const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
                        method: 'POST',
                        body: formData,
                        signal: controller.signal
                      });
                      clearTimeout(timeoutId);

                      const litterUrl = (await res.text()).trim();
                      if (litterUrl && litterUrl.startsWith('http')) {
                        return `https://wsrv.nl/?url=${encodeURIComponent(litterUrl)}&output=png`;
                      }
                    } catch (e) {}

                    // Secondary fallback to FreeImage
                    try {
                      const match = trimmed.match(/^data:image\/\w+;base64,(.+)$/);
                      const b64Data = match ? match[1] : trimmed;
                      const formData = new FormData();
                      formData.append('key', '6d207e02198a847aa98d0a2a901485a5');
                      formData.append('action', 'upload');
                      formData.append('source', b64Data);
                      formData.append('format', 'json');
                      const upRes = await fetch('https://freeimage.host/api/1/upload', { method: 'POST', body: formData });
                      const upJson: any = await upRes.json();
                      if (upJson?.image?.url) {
                        return upJson.image.url;
                      }
                    } catch (e) {}

                    return null;
                  }

                  // If standard http/https web URL
                  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                    if (trimmed.includes('wsrv.nl') || trimmed.includes('images.unsplash.com') || trimmed.includes('iili.io')) {
                      return trimmed;
                    }
                    return `https://wsrv.nl/?url=${encodeURIComponent(trimmed)}&output=jpg`;
                  }
                  return null;
                };

                let commonAssets: any[] | undefined = undefined;
                if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
                  const resolvedList = await Promise.all(mediaUrls.map((u, idx) => resolvePublicImageUrl(u, idx)));
                  const valid = resolvedList.filter(Boolean).map(url => ({ image: { url } }));
                  if (valid.length > 0) {
                    commonAssets = valid;
                  }
                } else if (mediaUrl) {
                  const single = await resolvePublicImageUrl(mediaUrl, 0);
                  if (single) {
                    commonAssets = [{ image: { url: single } }];
                  }
                }

                // 2. Post via modern GraphQL mutation for each selected channel
                let successCount = 0;
                let lastError = '';

                for (const channelId of profileIds) {
                  try {
                    let shareMode = 'addToQueue';
                    let dueAt = undefined;

                    if (scheduledAt) {
                      const d = new Date(scheduledAt);
                      if (!isNaN(d.getTime())) {
                        shareMode = 'customScheduled';
                        dueAt = d.toISOString();
                      }
                    } else if (scheduleMode === 'now') {
                      shareMode = 'shareNow';
                    }

                    const mutation = `mutation CreatePost($input: CreatePostInput!) {
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

                    // Adapt caption length based on social platform limits
                    const channelMeta = channels.find((c: any) => c.id === channelId);
                    const svc = (channelMeta?.service || '').toLowerCase();
                    const isShortConstrained = svc.includes('twitter') || svc.includes('x') || svc.includes('pinterest') || svc.includes('threads') || svc.includes('bluesky');

                    let postText = caption || '';
                    if (isShortConstrained && shortCaption) {
                      postText = shortCaption;
                      const maxLen = (svc.includes('twitter') || svc.includes('x')) ? 280 : (svc.includes('bluesky') ? 300 : 500);
                      if (postText.length > maxLen) {
                        postText = postText.substring(0, maxLen - 3) + '...';
                      }
                    } else if (!isShortConstrained && longCaption && (!caption || caption.length < longCaption.length)) {
                      postText = longCaption;
                    }

                    const input: any = {
                      channelId,
                      text: postText,
                      schedulingType: 'automatic',
                      mode: shareMode,
                      needsApproval: false,
                      saveToDraft: false,
                      metadata: {
                        tiktok: {
                          title: title || (postText ? postText.split('\n')[0].substring(0, 90) : 'Recipe')
                        }
                      }
                    };

                    if (dueAt) {
                      input.dueAt = dueAt;
                    }

                    if (commonAssets && commonAssets.length > 0) {
                      input.assets = commonAssets;
                    }

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 12000);
                    let postRes = await fetch('https://api.buffer.com', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${cleanToken}`
                      },
                      body: JSON.stringify({ query: mutation, variables: { input } }),
                      signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    let postData = await postRes.json();
                    let postPayload = postData.data?.createPost;

                    // If failed due to image read error and not TikTok, retry without invalid asset
                    if (
                      !postPayload?.post?.id &&
                      !svc.includes('tiktok') &&
                      (postData.errors?.[0]?.message?.toLowerCase().includes('image') ||
                       postPayload?.message?.toLowerCase().includes('image')) &&
                      input.assets
                    ) {
                      delete input.assets;
                      postRes = await fetch('https://api.buffer.com', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${cleanToken}`
                        },
                        body: JSON.stringify({ query: mutation, variables: { input } })
                      });
                      postData = await postRes.json();
                      postPayload = postData.data?.createPost;
                    }

                    if (postPayload?.post?.id || postPayload?.post?.status) {
                      successCount++;
                    } else if (postPayload?.message) {
                      lastError = postPayload.message;
                    } else if (postData.errors && postData.errors[0]) {
                      lastError = postData.errors[0].message;
                    }
                  } catch (e: any) {
                    lastError = e.message;
                  }
                }

                if (successCount > 0) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true,
                    message: scheduledAt 
                      ? `Successfully scheduled for ${new Date(scheduledAt).toLocaleString()} on ${successCount} channel(s)!`
                      : `Added to Buffer queue across ${successCount} channel(s)!`
                  }));
                  return;
                }

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  message: lastError || 'Failed to schedule post on Buffer.'
                }));
                return;
              }

              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, message: 'Unknown action' }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, message: err.message }));
            }
          });
          return;
        }

        // 2. High-Performance Image Proxy (Bypasses CORS & Hotlink Blockers)
        if (req.url?.startsWith('/api/proxy-image')) {
          const urlObj = new URL(req.url, 'http://localhost:3000');
          const targetImageUrl = urlObj.searchParams.get('url');

          if (!targetImageUrl || !targetImageUrl.startsWith('http')) {
            res.statusCode = 400;
            res.end('Missing or invalid url parameter');
            return;
          }

          try {
            const domain = new URL(targetImageUrl).origin;
            const imgRes = await fetch(targetImageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': `${domain}/`,
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
              }
            });

            if (!imgRes.ok) {
              // Fallback to fetch without referer
              const fallbackRes = await fetch(targetImageUrl);
              if (!fallbackRes.ok) {
                res.statusCode = fallbackRes.status;
                res.end('Image proxy fetch failed');
                return;
              }
              const buffer = Buffer.from(await fallbackRes.arrayBuffer());
              res.setHeader('Content-Type', fallbackRes.headers.get('content-type') || 'image/jpeg');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'public, max-age=86400');
              res.end(buffer);
              return;
            }

            const buffer = Buffer.from(await imgRes.arrayBuffer());
            res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.end(buffer);
            return;
          } catch (err) {
            res.statusCode = 500;
            res.end(`Proxy error: ${err.message}`);
            return;
          }
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), slydeServerPlugin()],
  server: {
    port: 3000,
    open: false
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        render: path.resolve(__dirname, 'render.html')
      }
    }
  }
});
