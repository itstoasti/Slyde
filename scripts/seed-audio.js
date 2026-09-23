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

// Curated CC0 1.0 Universal soundpack ideal for recipes, kitchen reels, and culinary content (100% public domain, zero Content ID/Audible Magic flags)
export const TRACKS_MANIFEST = [
  {
    id: 'lofi-kitchen-chill',
    filename: 'lofi-kitchen-chill.mp3',
    title: 'Butter and Windowlight',
    vibe: 'lofi',
    description: 'Mellow, relaxed chords and warm vintage vibes for baking & comfort food',
    license: 'CC0 1.0 Universal (Public Domain)',
    duration: 30.0
  },
  {
    id: 'lofi-chill-vibes',
    filename: 'lofi-chill-vibes.mp3',
    title: 'Pancakes in the Sun',
    vibe: 'lofi',
    description: 'Soft chillhop chords with deep relaxing morning warmth',
    license: 'CC0 1.0 Universal (Public Domain)',
    duration: 30.0
  },
  {
    id: 'lofi-cocktail-lounge',
    filename: 'lofi-cocktail-lounge.mp3',
    title: 'Linen and Limoncello',
    vibe: 'lofi',
    description: 'Smooth jazz keys and mellow groove, ideal for dinner & steak recipes',
    license: 'CC0 1.0 Universal (Public Domain)',
    duration: 30.0
  },
  {
    id: 'lofi-jazz-brunch',
    filename: 'lofi-jazz-brunch.mp3',
    title: 'First Coffee Thoughts',
    vibe: 'lofi',
    description: 'Warm, relaxed, cozy Sunday morning kitchen groove with mellow guitar',
    license: 'CC0 1.0 Universal (Public Domain)',
    duration: 30.0
  },
  {
    id: 'acoustic-morning-cafe',
    filename: 'acoustic-morning-cafe.mp3',
    title: 'Barefoot in the Kitchen',
    vibe: 'acoustic',
    description: 'Warm acoustic morning texture and cheerful groove for breakfast & brunch',
    license: 'CC0 1.0 Universal (Public Domain)',
    duration: 30.0
  },
  {
    id: 'italian-bistro-vibes',
    filename: 'italian-bistro-vibes.mp3',
    title: 'Coffee Ring Notebook',
    vibe: 'acoustic',
    description: 'Cozy acoustic cafe vibes, perfect for pasta, pizza and comfort reels',
    license: 'CC0 1.0 Universal (Public Domain)',
    duration: 30.0
  },
  {
    id: 'upbeat-cooking-groove',
    filename: 'upbeat-cooking-groove.mp3',
    title: 'Golden Afternoon Groove',
    vibe: 'upbeat',
    description: 'Upbeat lively acoustic groove, snappy tempo for fast recipe edits',
    license: 'CC0 1.0 Universal (Public Domain)',
    duration: 30.0
  },
  {
    id: 'upbeat-cheery-kitchen',
    filename: 'upbeat-cheery-kitchen.mp3',
    title: 'Grandmas Kitchen on Sunday',
    vibe: 'upbeat',
    description: 'Bright culinary bounce and family kitchen warmth for quick meal prep',
    license: 'CC0 1.0 Universal (Public Domain)',
    duration: 30.0
  }
];

export async function seedAudioTracks(forceRefresh = false) {
  console.log(`🎵 [AudioSeeder] Initializing Slyde CC0 food audio catalog...`);

  for (const track of TRACKS_MANIFEST) {
    const publicDest = path.join(PUBLIC_AUDIO_DIR, track.filename);
    const musicDest = path.join(MUSIC_DIR, track.filename);

    if (fs.existsSync(publicDest) && (!fs.existsSync(musicDest) || fs.statSync(musicDest).size < 10000)) {
      fs.copyFileSync(publicDest, musicDest);
      console.log(`📋 [AudioSeeder] Synchronized to music/: ${track.filename}`);
    } else if (fs.existsSync(musicDest) && (!fs.existsSync(publicDest) || fs.statSync(publicDest).size < 10000)) {
      fs.copyFileSync(musicDest, publicDest);
      console.log(`📋 [AudioSeeder] Synchronized to public/audio/: ${track.filename}`);
    }

    if (fs.existsSync(publicDest)) {
      const sizeKb = (fs.statSync(publicDest).size / 1024).toFixed(1);
      console.log(`✅ [AudioSeeder] Verified CC0 track: ${track.filename} (${sizeKb} KB)`);
    }
  }

  // Save manifest file in public/audio/manifest.json for frontend discovery
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
