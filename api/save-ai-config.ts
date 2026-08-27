import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const config = req.body;
      const aiConfigPath = path.resolve(process.cwd(), 'ai_config.json');
      try {
        fs.writeFileSync(aiConfigPath, JSON.stringify(config, null, 2), 'utf-8');
      } catch (e) {}
      return res.status(200).json({ success: true, message: 'AI configuration saved' });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  return res.status(200).json({ success: true });
}
