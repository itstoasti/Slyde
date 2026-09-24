import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-ignore
import { extractRecipe } from '../server/batchScheduler.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { url, brandDefaults } = req.body || {};
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ success: false, message: 'URL is required' });
      }

      const defaultBranding = {
        brandName: 'SnapRecipes',
        socialHandle: '@snaprecipes',
        ctaUrl: 'snaprecipes.xyz',
        brandLogo: '/snaprecipes-app-icon.png',
        brandLogoSize: 58,
        ...(brandDefaults || {})
      };

      const recipe = await extractRecipe(url, defaultBranding);
      return res.status(200).json({ success: true, recipe });
    } catch (err: any) {
      console.error('[api/extract-recipe] Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
