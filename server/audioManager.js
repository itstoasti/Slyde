import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateAllStarterTracks } from '../scripts/generate-starter-audio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MUSIC_DIR = path.resolve(__dirname, '../music');

export function getAvailableAudioTracks() {
  if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
  }

  let files = fs.readdirSync(MUSIC_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext);
  });

  if (files.length === 0) {
    try {
      generateAllStarterTracks();
      files = fs.readdirSync(MUSIC_DIR).filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext);
      });
    } catch (e) {
      console.warn('[AudioManager] Could not auto-generate starter tracks:', e.message);
    }
  }

  return files.map(f => ({
    filename: f,
    filepath: path.join(MUSIC_DIR, f),
    vibe: detectVibe(f)
  }));
}

function detectVibe(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('lofi') || lower.includes('chill') || lower.includes('mellow')) return 'lofi';
  if (lower.includes('acoustic') || lower.includes('coffee') || lower.includes('guitar')) return 'acoustic';
  if (lower.includes('upbeat') || lower.includes('groove') || lower.includes('dance') || lower.includes('pop')) return 'upbeat';
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
