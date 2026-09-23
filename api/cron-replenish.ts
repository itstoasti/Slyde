import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-ignore
import { topUpBufferQueue, getBufferQueueStatus, getReserveQueueStatus, notifyTelegram } from '../server/bufferReplenisher.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'slyde-bay.vercel.app';
    const preferredTime = (req.query.time as string) || '11:30';
    const musicVibe = (req.query.vibe as string) || 'lofi';

    console.log(`[cron-replenish] Running automated Buffer replenisher check...`);

    // 1. Check current Buffer queue status
    const bufferStatus = await getBufferQueueStatus();
    if (!bufferStatus.success) {
      console.warn('[cron-replenish] Failed to query Buffer status:', bufferStatus.message);
      return res.status(500).json({ success: false, message: bufferStatus.message });
    }

    console.log(`[cron-replenish] Buffer queue: ${bufferStatus.totalScheduled}/10 posts. Slots open: ${bufferStatus.slotsAvailable}`);

    // If Buffer is completely full (10/10)
    if (bufferStatus.slotsAvailable === 0) {
      const reserve = getReserveQueueStatus();
      console.log(`[cron-replenish] Buffer is full (10/10). Reserve has ${reserve.pendingCount} pending recipe(s).`);

      // Check if reserve is running low
      if (reserve.pendingCount < 3) {
        await notifyTelegram(
          `⚠️ <b>Buffer Reserve Running Low!</b>\n\n` +
          `Your Buffer queue is currently 10/10 full, but only <b>${reserve.pendingCount}</b> recipe(s) remain in your Slyde reserve queue.\n\n` +
          `Paste 15–30 recipe links here to refill your monthly queue anytime!`
        );
      }

      return res.status(200).json({
        success: true,
        action: 'none',
        message: 'Buffer queue is completely full (10/10 posts scheduled). Autopilot is running on schedule.',
        totalScheduled: bufferStatus.totalScheduled,
        slotsAvailable: 0,
        remainingInReserve: reserve.pendingCount
      });
    }

    // 2. Top up Buffer queue from reserve
    const result = await topUpBufferQueue({
      host,
      preferredTime,
      musicVibe
    });

    // 3. Notify via Telegram if posts were scheduled
    if (result.scheduledCount > 0) {
      const postTitles = (result.newlyScheduled || []).map((p: any, i: number) => 
        `  ${i + 1}. <b>${p.title}</b> — <i>${new Date(p.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</i>`
      ).join('\n');

      await notifyTelegram(
        `🤖 <b>Daily Autopilot Replenished Buffer!</b>\n\n` +
        `✅ Auto-scheduled <b>${result.scheduledCount}</b> new recipe(s) directly to Buffer!\n` +
        `📊 Buffer Queue: <b>${result.totalScheduled}/10</b> posts active\n` +
        `📦 Reserve Queue: <b>${result.remainingInReserve}</b> recipe(s) in reserve\n\n` +
        `<b>Newly Scheduled:</b>\n${postTitles}\n\n` +
        `<i>✨ Posts scheduled for direct automated publishing to TikTok & Instagram.</i>`
      );
    }

    // Check if reserve is now running low
    if (result.remainingInReserve < 3) {
      await notifyTelegram(
        `⚠️ <b>Buffer Reserve Running Low!</b>\n\n` +
        `Only <b>${result.remainingInReserve}</b> recipe(s) remain in your reserve queue.\n\n` +
        `Paste 15–30 recipe links here anytime to refill your monthly reserve!`
      );
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[cron-replenish] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
