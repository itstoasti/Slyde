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
      const updated = {
        ...defaultTelegram,
        ...(botToken !== undefined && { botToken }),
        ...(chatId !== undefined && { chatId }),
        ...(includeCaption !== undefined && { includeCaption }),
        ...(sendAsAlbum !== undefined && { sendAsAlbum }),
        ...(inboundListenerEnabled !== undefined && { inboundListenerEnabled }),
        ...(messageThreadId !== undefined && { messageThreadId })
      };
      writeJsonFile('telegram_config.json', updated);
      return res.status(200).json({ success: true, config: updated });
    }

    const saved = readJsonFile('telegram_config.json', {});
    return res.status(200).json({
      ...defaultTelegram,
      ...saved,
      botToken: process.env.TELEGRAM_BOT_TOKEN || saved.botToken || '',
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
      const updated = { ...current, ...(req.body || {}) };
      writeJsonFile('gemini_config.json', updated);
      return res.status(200).json({ success: true, config: updated });
    }

    const saved = readJsonFile('gemini_config.json', {});
    return res.status(200).json({
      ...defaultAi,
      ...saved,
      geminiApiKey: process.env.GEMINI_API_KEY || saved.geminiApiKey || '',
      openRouterApiKey: process.env.OPENROUTER_API_KEY || saved.openRouterApiKey || ''
    });
  }

  // 3. BRANDING DEFAULTS
  if (type === 'branding') {
    const defaultBranding = {
      brandName: 'slyde.ai',
      socialHandle: '@slyde',
      ctaUrl: 'slyde.ai/recipe',
      brandLogo: '',
      brandLogoSize: 36
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
      const updated = { ...defaultBuffer, ...(req.body || {}) };
      writeJsonFile('buffer_config.json', updated);
      return res.status(200).json({ success: true, config: updated });
    }

    const saved = readJsonFile('buffer_config.json', defaultBuffer);
    return res.status(200).json({ ...defaultBuffer, ...saved });
  }

  // Default: Return status
  return res.status(200).json({ success: true, message: 'Slyde Unified Configuration API' });
}
