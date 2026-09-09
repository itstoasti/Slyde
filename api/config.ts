import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as fs from 'fs';
import * as path from 'path';

function getFilePath(filename: string): string {
  return path.resolve(process.cwd(), filename);
}

function readJsonFile(filename: string, fallback: any = {}): any {
  try {
    const p = getFilePath(filename);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (e) {}
  return fallback;
}

function writeJsonFile(filename: string, data: any): void {
  try {
    const p = getFilePath(filename);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Determine config type from query, URL path, or body
  const type = (req.query.type as string) || (req.body && req.body._type) || 'all';

function maskSecret(str: string): string {
  if (!str || str.length < 8) return str ? '••••••••' : '';
  return str.substring(0, 4) + '••••••••' + str.substring(str.length - 4);
}

  // 1. TELEGRAM CONFIG
  if (type === 'telegram') {
    const defaultTelegram = {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '1294588369',
      includeCaption: true,
      sendAsAlbum: true,
      inboundListenerEnabled: true
    };

    if (req.method === 'POST') {
      const { botToken, chatId, includeCaption, sendAsAlbum, inboundListenerEnabled, messageThreadId } = req.body || {};
      const current = readJsonFile('telegram_config.json', {});
      const updated = {
        ...defaultTelegram,
        ...current,
        // Only update botToken if a non-masked token is sent
        ...(botToken !== undefined && !botToken.includes('••••') && { botToken }),
        ...(chatId !== undefined && { chatId }),
        ...(includeCaption !== undefined && { includeCaption }),
        ...(sendAsAlbum !== undefined && { sendAsAlbum }),
        ...(inboundListenerEnabled !== undefined && { inboundListenerEnabled }),
        ...(messageThreadId !== undefined && { messageThreadId })
      };
      writeJsonFile('telegram_config.json', updated);
      return res.status(200).json({ success: true, config: { ...updated, botToken: maskSecret(updated.botToken) } });
    }

    const saved = readJsonFile('telegram_config.json', {});
    const rawToken = process.env.TELEGRAM_BOT_TOKEN || saved.botToken || '';
    return res.status(200).json({
      ...defaultTelegram,
      ...saved,
      hasToken: Boolean(rawToken),
      botToken: maskSecret(rawToken),
      chatId: process.env.TELEGRAM_CHAT_ID || saved.chatId || '1294588369'
    });
  }

  // 2. AI CONFIG (Gemini & OpenRouter)
  if (type === 'ai') {
    const defaultAi = {
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
      preferredProvider: 'gemini',
      openRouterModel: 'google/gemini-2.5-flash'
    };

    if (req.method === 'POST') {
      const current = readJsonFile('gemini_config.json', defaultAi);
      const incoming = req.body || {};
      const updated = {
        ...current,
        ...incoming,
        ...(incoming.geminiApiKey && incoming.geminiApiKey.includes('••••') && { geminiApiKey: current.geminiApiKey }),
        ...(incoming.openRouterApiKey && incoming.openRouterApiKey.includes('••••') && { openRouterApiKey: current.openRouterApiKey })
      };
      writeJsonFile('gemini_config.json', updated);
      return res.status(200).json({ success: true, config: { ...updated, geminiApiKey: maskSecret(updated.geminiApiKey), openRouterApiKey: maskSecret(updated.openRouterApiKey) } });
    }

    const saved = readJsonFile('gemini_config.json', {});
    const rawGemini = process.env.GEMINI_API_KEY || saved.geminiApiKey || '';
    const rawOpenRouter = process.env.OPENROUTER_API_KEY || saved.openRouterApiKey || '';
    return res.status(200).json({
      ...defaultAi,
      ...saved,
      hasGeminiKey: Boolean(rawGemini),
      geminiApiKey: maskSecret(rawGemini),
      hasOpenRouterKey: Boolean(rawOpenRouter),
      openRouterApiKey: maskSecret(rawOpenRouter)
    });
  }

  // 3. BRANDING DEFAULTS
  if (type === 'branding') {
    const defaultBranding = {
      brandName: 'SnapRecipes',
      socialHandle: '@snaprecipes',
      ctaUrl: 'snaprecipes.xyz',
      brandLogo: '/snaprecipes-app-icon.png',
      brandLogoSize: 58
    };

    if (req.method === 'POST') {
      const updated = { ...defaultBranding, ...(req.body || {}) };
      writeJsonFile('branding_config.json', updated);
      return res.status(200).json({ success: true, config: updated });
    }

    const saved = readJsonFile('branding_config.json', defaultBranding);
    return res.status(200).json({ ...defaultBranding, ...saved });
  }

  // 4. RECIPES QUEUE
  if (type === 'recipes') {
    if (req.method === 'POST') {
      const { queue = [], activeId } = req.body || {};
      writeJsonFile('recipes_queue.json', { queue, activeId });
      return res.status(200).json({ success: true, count: queue.length });
    }

    const saved = readJsonFile('recipes_queue.json', { queue: [], activeId: null });
    return res.status(200).json(saved);
  }

  // 5. BUFFER CONFIG
  if (type === 'buffer') {
    const defaultBuffer = {
      accessToken: '',
      selectedProfileIds: [],
      profiles: [],
      scheduleMode: 'queue'
    };

    if (req.method === 'POST') {
      const current = readJsonFile('buffer_config.json', defaultBuffer);
      const incoming = req.body || {};
      const updated = {
        ...current,
        ...incoming,
        ...(incoming.accessToken && incoming.accessToken.includes('••••') && { accessToken: current.accessToken })
      };
      writeJsonFile('buffer_config.json', updated);
      return res.status(200).json({ success: true, config: { ...updated, accessToken: maskSecret(updated.accessToken) } });
    }

    const saved = readJsonFile('buffer_config.json', defaultBuffer);
    return res.status(200).json({
      ...defaultBuffer,
      ...saved,
      hasToken: Boolean(saved.accessToken),
      accessToken: maskSecret(saved.accessToken || '')
    });
  }

  // Default: Return status
  return res.status(200).json({ success: true, message: 'Slyde Unified Configuration API' });
}
