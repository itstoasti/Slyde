#!/usr/bin/env node

/**
 * Slyde CLI Batch Scheduler
 * Usage:
 *   node scripts/batch-schedule.js
 *   node scripts/batch-schedule.js https://... https://...
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scheduleBatch } from '../server/batchScheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const URLS_FILE = path.join(ROOT_DIR, 'batch_urls.txt');

async function main() {
  console.log('\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════════════');
  console.log('\x1b[1m\x1b[33m%s\x1b[0m', '  🍳 SLYDE AUTOMATED DAILY RECIPE SCHEDULER');
  console.log('\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════════════');

  let urls = process.argv.slice(2).filter(arg => arg.startsWith('http'));

  if (urls.length === 0 && fs.existsSync(URLS_FILE)) {
    const fileContent = fs.readFileSync(URLS_FILE, 'utf8');
    urls = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('http') && !line.startsWith('#'));
  }

  if (urls.length === 0) {
    console.log('\x1b[31m%s\x1b[0m', '⚠️  No recipe URLs found!');
    console.log('\x1b[37m%s\x1b[0m', '👉 Add recipe URLs to batch_urls.txt (one per line) or pass them as CLI arguments:');
    console.log('\x1b[90m%s\x1b[0m', '   node scripts/batch-schedule.js https://allrecipes.com/...');
    process.exit(1);
  }

  console.log(`📋 Found \x1b[32m${urls.length}\x1b[0m recipe URL(s) ready to schedule.`);
  console.log('🎵 Audio: Commercial-Safe High-Vibe Audio Tracks Embedded');
  console.log('📱 Platforms: TikTok (60fps Video), Instagram (Carousel), Threads\n');

  try {
    const result = await scheduleBatch({
      urls,
      cadence: '1-daily',
      preferredTime: '11:30',
      musicVibe: 'auto',
      onProgress: (p) => {
        if (p.stage === 'extracting') console.log(`⏳ [${p.current}/${p.total}] Extracting: ${p.url}`);
        if (p.stage === 'rendering_video') console.log(`🎬 [${p.current}/${p.total}] Rendering 60 FPS Video with Soundtrack for "${p.title}"...`);
        if (p.stage === 'scheduling') console.log(`📅 [${p.current}/${p.total}] Scheduling to Buffer for ${new Date(p.scheduledAt).toLocaleString()}`);
      }
    });

    console.log('\n\x1b[32m%s\x1b[0m', '🎉 ═══════════════════════════════════════════════════════');
    console.log('\x1b[32m%s\x1b[0m', `   SUCCESS! Scheduled ${result.scheduled}/${result.total} recipes across your social queue!`);
    console.log('\x1b[32m%s\x1b[0m', '═══════════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', `❌ Batch schedule failed: ${err.message}`);
    process.exit(1);
  }
}

main();
