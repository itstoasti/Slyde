import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import { scheduleBatch } from '../server/batchScheduler.js';

const ROOT_DIR = process.cwd();
const SCHEDULED_POSTS_FILE = path.join(ROOT_DIR, 'scheduled_posts.json');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch current scheduled posts list
  if (req.method === 'GET') {
    try {
      if (fs.existsSync(SCHEDULED_POSTS_FILE)) {
        const data = JSON.parse(fs.readFileSync(SCHEDULED_POSTS_FILE, 'utf8'));
        return res.status(200).json({ success: true, posts: data.posts || [], lastUpdated: data.lastUpdated });
      }
      return res.status(200).json({ success: true, posts: [] });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // POST: Execute batch schedule
  if (req.method === 'POST') {
    try {
      const {
        urls = [],
        cadence = '1-daily',
        preferredTime = '11:30',
        secondTime = '17:30',
        startDate,
        musicVibe = 'auto',
        instagramFormat = 'carousel'
      } = req.body || {};

      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ success: false, message: 'Please provide an array of recipe URLs.' });
      }

      console.log(`[api/batch-schedule] Processing ${urls.length} URLs...`);

      const result = await scheduleBatch({
        urls,
        cadence,
        preferredTime,
        secondTime,
        startDate,
        musicVibe,
        instagramFormat
      });

      return res.status(200).json(result);
    } catch (err: any) {
      console.error('[api/batch-schedule] Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
