import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedAudioTracks } from '../scripts/seed-audio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MUSIC_DIR = path.resolve(__dirname, '../music');
const PUBLIC_AUDIO_DIR = path.resolve(__dirname, '../public/audio');

export function getAvailableAudioTracks() {
  const targetDir = fs.existsSync(MUSIC_DIR) && fs.readdirSync(MUSIC_DIR).some(f => f.endsWith('.mp3'))
    ? MUSIC_DIR
    : PUBLIC_AUDIO_DIR;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let files = fs.readdirSync(targetDir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext);
  });

  if (files.length === 0) {
    try {
      seedAudioTracks();
      files = fs.readdirSync(targetDir).filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext);
      });
    } catch (e) {
      console.warn('[AudioManager] Could not auto-seed tracks:', e.message);
    }
  }

  return files.map(f => ({
    filename: f,
    filepath: path.join(targetDir, f),
    vibe: detectVibe(f)
  }));
}

function detectVibe(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('lofi') || lower.includes('chill') || lower.includes('mellow') || lower.includes('lounge') || lower.includes('brunch')) return 'lofi';
  if (lower.includes('acoustic') || lower.includes('coffee') || lower.includes('guitar') || lower.includes('bistro') || lower.includes('italian')) return 'acoustic';
  if (lower.includes('upbeat') || lower.includes('groove') || lower.includes('dance') || lower.includes('pop') || lower.includes('cheery')) return 'upbeat';
  return 'general';
}

/**
 * Select a suitable background track for a recipe
 * @param {string} [recipeTitle] - Title of the recipe (used for deterministic shuffle)
 * @param {string} [preferredVibe] - 'lofi' | 'acoustic' | 'upbeat' | 'shuffle' | 'auto'
 * @returns {string|null} - Absolute path to audio track
 */
export function selectAudioTrack(recipeTitle = '', preferredVibe = 'auto') {
  const tracks = getAvailableAudioTracks();
  if (tracks.length === 0) return null;

  const cleanVibe = (preferredVibe || 'auto').toLowerCase();

  if (cleanVibe !== 'auto' && cleanVibe !== 'shuffle') {
    const matched = tracks.filter(t => t.vibe === cleanVibe);
    if (matched.length > 0) {
      // Deterministic pick based on recipe title so the same recipe gets the same track
      const hash = Math.abs(hashCode(recipeTitle || 'recipe'));
      return matched[hash % matched.length].filepath;
    }
  }

  // Auto/Shuffle rotation
  const hash = Math.abs(hashCode(recipeTitle || String(Date.now())));
  return tracks[hash % tracks.length].filepath;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
