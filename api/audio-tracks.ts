import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-ignore
import { getAvailableAudioTracks } from '../server/audioManager.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const tracks = getAvailableAudioTracks();
    return res.status(200).json({
      success: true,
      count: tracks.length,
      tracks: tracks.map((t: any) => ({
        filename: t.filename,
        vibe: t.vibe
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
