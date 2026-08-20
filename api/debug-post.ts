import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = req.body || {};
  const summary: any = {};

  for (const [key, val] of Object.entries(body)) {
    if (typeof val === 'string') {
      if (val.length > 200) {
        summary[key] = `[string, ${val.length} chars, starts: ${val.substring(0, 100)}]`;
      } else {
        summary[key] = val;
      }
    } else if (Array.isArray(val)) {
      summary[key] = `[array, ${val.length} items]`;
      if (val.length > 0 && typeof val[0] === 'string') {
        summary[key + '_first'] = val[0].length > 200 
          ? `[string, ${val[0].length} chars, starts: ${val[0].substring(0, 100)}]`
          : val[0];
      }
    } else {
      summary[key] = val;
    }
  }

  return res.status(200).json({ receivedKeys: Object.keys(body), summary });
}
