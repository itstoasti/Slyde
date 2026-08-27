import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const envGeminiKey = process.env.GEMINI_API_KEY;
  const envOpenRouterKey = process.env.OPENROUTER_API_KEY;

  const aiConfigPath = path.resolve(process.cwd(), 'ai_config.json');
  if (fs.existsSync(aiConfigPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(aiConfigPath, 'utf-8'));
      return res.status(200).json({
        provider: 'gemini',
        geminiApiKey: envGeminiKey || data.geminiApiKey || '',
        geminiModel: data.geminiModel || 'gemini-2.5-flash',
        openRouterApiKey: envOpenRouterKey || data.openRouterApiKey || '',
        openRouterModel: data.openRouterModel || 'meta-llama/llama-3.3-70b-instruct'
      });
    } catch (e) {}
  }

  return res.status(200).json({
    provider: 'gemini',
    geminiApiKey: envGeminiKey || '',
    geminiModel: 'gemini-2.5-flash',
    openRouterApiKey: envOpenRouterKey || '',
    openRouterModel: 'meta-llama/llama-3.3-70b-instruct'
  });
}
