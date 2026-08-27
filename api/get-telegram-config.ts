import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

const DEFAULT_CONFIG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '@Claaaaaarkbot',
  includeCaption: true,
  sendAsAlbum: true,
  inboundListenerEnabled: true
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Check environment variables first
  const envToken = process.env.TELEGRAM_BOT_TOKEN;
  const envChatId = process.env.TELEGRAM_CHAT_ID;

  // 2. Check local file if exists
  const configPath = path.resolve(process.cwd(), 'telegram_config.json');
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return res.status(200).json({
        ...DEFAULT_CONFIG,
        ...data,
        botToken: envToken || data.botToken || DEFAULT_CONFIG.botToken,
        chatId: envChatId || data.chatId || DEFAULT_CONFIG.chatId
      });
    } catch (e) {}
  }

  return res.status(200).json({
    ...DEFAULT_CONFIG,
    botToken: envToken || DEFAULT_CONFIG.botToken,
    chatId: envChatId || DEFAULT_CONFIG.chatId
  });
}
