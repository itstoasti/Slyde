/**
 * Auto-Seeder for Slyde Food & Recipe Royalty-Free Audio Catalog
 * Downloads, trims, and normalizes high-vibe culinary soundtracks for TikTok, Instagram Reels, and YouTube Shorts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_AUDIO_DIR = path.join(ROOT_DIR, 'public', 'audio');
const MUSIC_DIR = path.join(ROOT_DIR, 'music');

// Ensure directories exist
for (const dir of [PUBLIC_AUDIO_DIR, MUSIC_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Locate ffmpeg binary
async function getFfmpegPath() {
  try {
    const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg');
    return ffmpegInstaller.default?.path || ffmpegInstaller.path || 'ffmpeg';
  } catch {
    return 'ffmpeg';
  }
}

// Curated soundpack ideal for recipes, kitchen reels, and culinary content
export const TRACKS_MANIFEST = [
  {
    id: 'lofi-kitchen-chill',
    filename: 'lofi-kitchen-chill.mp3',
    title: 'Cozy Kitchen Bossa',
    vibe: 'lofi',
    description: 'Mellow bossa nova rhythms, warm chords, relaxed cooking mood',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bossa%20Antigua.mp3',
    startTime: '00:00:04',
    duration: 12.0
  },
  {
    id: 'acoustic-morning-cafe',
    filename: 'acoustic-morning-cafe.mp3',
    title: 'Carefree Morning Cafe',
    vibe: 'acoustic',
    description: 'Warm acoustic guitar, cheerful whistling, bright breakfast vibe',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3',
    startTime: '00:00:02',
    duration: 12.0
  },
  {
    id: 'upbeat-cooking-groove',
    filename: 'upbeat-cooking-groove.mp3',
    title: 'Life of Riley Foodie',
    vibe: 'upbeat',
    description: 'Upbeat lively acoustic groove, snappy tempo for fast recipe edits',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Life%20of%20Riley.mp3',
    startTime: '00:00:00',
    duration: 12.0
  },
  {
    id: 'italian-bistro-vibes',
    filename: 'italian-bistro-vibes.mp3',
    title: 'Bushwick Tarantella Bistro',
    vibe: 'acoustic',
    description: 'Italian accordion and mandolin, perfect for pasta and pizza reels',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bushwick%20Tarantella.mp3',
    startTime: '00:00:02',
    duration: 12.0
  },
  {
    id: 'lofi-cocktail-lounge',
    filename: 'lofi-cocktail-lounge.mp3',
    title: 'Airport Lounge Chill',
    vibe: 'lofi',
    description: 'Smooth vibraphone and jazz keys, ideal for dinner dates and steak recipes',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Airport%20Lounge.mp3',
    startTime: '00:00:03',
    duration: 12.0
  },
  {
    id: 'lofi-jazz-brunch',
    filename: 'lofi-jazz-brunch.mp3',
    title: 'Sunday Jazz Brunch',
    vibe: 'lofi',
    description: 'Warm, relaxed, cozy Sunday morning kitchen groove with mellow guitar',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Jazz%20Brunch.mp3',
    startTime: '00:00:03',
    duration: 12.0
  },
  {
    id: 'lofi-chill-vibes',
    filename: 'lofi-chill-vibes.mp3',
    title: 'Cozy Kitchen Chill Vibes',
    vibe: 'lofi',
    description: 'Soft slow jazz trio chords with deep relaxing warmth',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cool%20Vibes.mp3',
    startTime: '00:00:02',
    duration: 12.0
  },
  {
    id: 'upbeat-cheery-kitchen',
    filename: 'upbeat-cheery-kitchen.mp3',
    title: 'Cheery Monday Culinary',
    vibe: 'upbeat',
    description: 'Bright pop-acoustic energy for quick meal prep and baking',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cheery%20Monday.mp3',
    startTime: '00:00:00',
    duration: 12.0
  }
];

export async function seedAudioTracks(forceRefresh = false) {
  const ffmpeg = await getFfmpegPath();
  console.log(`🎵 [AudioSeeder] Initializing Slyde food audio engine (using ffmpeg: ${ffmpeg})...`);

  for (const track of TRACKS_MANIFEST) {
    const publicDest = path.join(PUBLIC_AUDIO_DIR, track.filename);
    const musicDest = path.join(MUSIC_DIR, track.filename);

    if (!forceRefresh && fs.existsSync(publicDest) && fs.existsSync(musicDest) && fs.statSync(publicDest).size > 10000) {
      console.log(`⚡ [AudioSeeder] Already cached: ${track.filename}`);
      continue;
    }

    const tmpRaw = path.join('/tmp', `raw_${track.filename}`);
    try {
      console.log(`⬇️ [AudioSeeder] Fetching ${track.title} (${track.vibe})...`);
      const res = await fetch(track.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const arrayBuf = await res.arrayBuffer();
      fs.writeFileSync(tmpRaw, Buffer.from(arrayBuf));

      // Trim with FFmpeg: start at sweet spot, length 12s, normalize volume, gentle fade in/out
      console.log(`✂️ [AudioSeeder] Trimming & optimizing ${track.filename} for vertical video...`);
      execFileSync(ffmpeg, [
        '-y',
        '-ss', track.startTime,
        '-t', String(track.duration),
        '-i', tmpRaw,
        '-vn',
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-ar', '44100',
        '-af', 'afade=t=in:ss=0:d=0.25,afade=t=out:st=10.5:d=1.5',
        publicDest
      ], { stdio: 'pipe' });

      // Copy to music/ for local server/bot compatibility
      fs.copyFileSync(publicDest, musicDest);

      const sizeKb = (fs.statSync(publicDest).size / 1024).toFixed(1);
      console.log(`✅ [AudioSeeder] Successfully seeded: ${track.filename} (${sizeKb} KB)`);
    } catch (err) {
      console.error(`❌ [AudioSeeder] Failed to process ${track.filename}:`, err.message);
    } finally {
      try { if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw); } catch {}
    }
  }

  // Save manifest file in public/audio/manifest.json for frontend instant discovery
  const manifestPath = path.join(PUBLIC_AUDIO_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(TRACKS_MANIFEST, null, 2));
  console.log(`✨ [AudioSeeder] Wrote track manifest to ${manifestPath}`);
}

// Run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedAudioTracks(process.argv.includes('--force'))
    .then(() => console.log('🎉 [AudioSeeder] Complete!'))
    .catch((err) => console.error('Error seeding audio:', err));
}
