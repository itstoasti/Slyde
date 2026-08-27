import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

const DEFAULT_BRANDING = {
  brandName: 'SnapRecipes',
  socialHandle: '@snaprecipes',
  ctaUrl: 'snaprecipes.xyz',
  brandLogo: '/snaprecipes-app-icon.png',
  brandLogoSize: 58
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const configPath = path.resolve(process.cwd(), 'branding_config.json');
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return res.status(200).json({ ...DEFAULT_BRANDING, ...data });
    } catch (e) {}
  }

  return res.status(200).json(DEFAULT_BRANDING);
}
