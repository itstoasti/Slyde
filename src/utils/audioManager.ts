export interface AudioVibeOption {
  id: 'lofi' | 'acoustic' | 'upbeat' | 'auto';
  name: string;
  description: string;
  emoji: string;
}

export const AUDIO_VIBE_PRESETS: AudioVibeOption[] = [
  {
    id: 'lofi',
    name: 'Cozy Lo-Fi Kitchen (Default)',
    description: 'Mellow, relaxed chords and warm vintage vibes for baking & comfort food',
    emoji: '☕'
  },
  {
    id: 'acoustic',
    name: 'Acoustic Morning Cafe',
    description: 'Warm fingerpicked acoustic guitar & mandolin for brunch, salads & bistro recipes',
    emoji: '🎸'
  },
  {
    id: 'upbeat',
    name: 'Upbeat Cooking Groove',
    description: 'Lively, snappy rhythm for fast meal prep, air fryer hacks & dinner reels',
    emoji: '🍳'
  },
  {
    id: 'auto',
    name: 'Auto-Rotate / Smart Shuffle',
    description: 'Picks the best culinary soundtrack matching your recipe tone',
    emoji: '🎲'
  }
];

export interface AudioTrackInfo {
  id: string;
  filename: string;
  title: string;
  vibe: 'lofi' | 'acoustic' | 'upbeat' | 'general';
  description: string;
  url: string;
}

export const DEFAULT_FOOD_TRACKS: AudioTrackInfo[] = [
  {
    id: 'lofi-kitchen-chill',
    filename: 'lofi-kitchen-chill.mp3',
    title: 'Cozy Kitchen Bossa',
    vibe: 'lofi',
    description: 'Mellow bossa nova rhythms, warm chords, relaxed cooking mood',
    url: '/audio/lofi-kitchen-chill.mp3'
  },
  {
    id: 'lofi-cocktail-lounge',
    filename: 'lofi-cocktail-lounge.mp3',
    title: 'Airport Lounge Chill',
    vibe: 'lofi',
    description: 'Smooth vibraphone and jazz keys, ideal for dinner dates and steak recipes',
    url: '/audio/lofi-cocktail-lounge.mp3'
  },
  {
    id: 'lofi-jazz-brunch',
    filename: 'lofi-jazz-brunch.mp3',
    title: 'Sunday Jazz Brunch',
    vibe: 'lofi',
    description: 'Warm, relaxed, cozy Sunday morning kitchen groove with mellow guitar',
    url: '/audio/lofi-jazz-brunch.mp3'
  },
  {
    id: 'lofi-chill-vibes',
    filename: 'lofi-chill-vibes.mp3',
    title: 'Cozy Kitchen Chill Vibes',
    vibe: 'lofi',
    description: 'Soft slow jazz trio chords with deep relaxing warmth',
    url: '/audio/lofi-chill-vibes.mp3'
  },
  {
    id: 'acoustic-morning-cafe',
    filename: 'acoustic-morning-cafe.mp3',
    title: 'Carefree Morning Cafe',
    vibe: 'acoustic',
    description: 'Warm acoustic guitar, cheerful whistling, bright breakfast vibe',
    url: '/audio/acoustic-morning-cafe.mp3'
  },
  {
    id: 'italian-bistro-vibes',
    filename: 'italian-bistro-vibes.mp3',
    title: 'Bushwick Tarantella Bistro',
    vibe: 'acoustic',
    description: 'Italian accordion and mandolin, perfect for pasta and pizza reels',
    url: '/audio/italian-bistro-vibes.mp3'
  },
  {
    id: 'upbeat-cooking-groove',
    filename: 'upbeat-cooking-groove.mp3',
    title: 'Life of Riley Foodie',
    vibe: 'upbeat',
    description: 'Upbeat lively acoustic groove, snappy tempo for fast recipe edits',
    url: '/audio/upbeat-cooking-groove.mp3'
  },
  {
    id: 'upbeat-cheery-kitchen',
    filename: 'upbeat-cheery-kitchen.mp3',
    title: 'Cheery Monday Culinary',
    vibe: 'upbeat',
    description: 'Bright pop-acoustic energy for quick meal prep and baking',
    url: '/audio/upbeat-cheery-kitchen.mp3'
  }
];

/**
 * Get user's preferred audio vibe from localStorage (defaults to 'lofi')
 */
export function getPreferredAudioVibe(): 'lofi' | 'acoustic' | 'upbeat' | 'auto' {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('slyde_preferred_audio_vibe');
      if (saved === 'lofi' || saved === 'acoustic' || saved === 'upbeat' || saved === 'auto') {
        return saved;
      }
    } catch (e) {}
  }
  return 'lofi';
}

/**
 * Save user's preferred audio vibe to localStorage
 */
export function setPreferredAudioVibe(vibe: 'lofi' | 'acoustic' | 'upbeat' | 'auto'): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('slyde_preferred_audio_vibe', vibe);
    } catch (e) {}
  }
}

export async function fetchAudioTracks(): Promise<AudioTrackInfo[]> {
  try {
    const res = await fetch('/audio/manifest.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((t: any) => ({
          ...t,
          url: `/audio/${t.filename}`
        }));
      }
    }
  } catch (e) {}

  return DEFAULT_FOOD_TRACKS;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Deterministically pick an audio track matching the recipe and desired vibe.
 * Defaults to the user's preferred vibe ('lofi').
 */
export function selectTrackForRecipe(
  recipeTitle: string = '',
  preferredVibe?: string,
  availableTracks: AudioTrackInfo[] = DEFAULT_FOOD_TRACKS
): AudioTrackInfo {
  const tracks = availableTracks.length > 0 ? availableTracks : DEFAULT_FOOD_TRACKS;
  const effectiveVibe = (preferredVibe || getPreferredAudioVibe()).toLowerCase();

  // If specific vibe requested (e.g. lofi, acoustic, upbeat)
  if (effectiveVibe !== 'auto' && effectiveVibe !== 'shuffle') {
    const matched = tracks.filter(t => t.vibe === effectiveVibe);
    if (matched.length > 0) {
      // Rotate through all matched tracks deterministically per recipe title
      const hash = Math.abs(hashCode(recipeTitle || 'lofi-recipe'));
      return matched[hash % matched.length];
    }
  }

  // Auto-detect from recipe title keywords when 'auto' is selected
  const lowerTitle = recipeTitle.toLowerCase();
  if (lowerTitle.includes('pasta') || lowerTitle.includes('pizza') || lowerTitle.includes('lasagna') || lowerTitle.includes('risotto') || lowerTitle.includes('italian')) {
    const bistro = tracks.find(t => t.id === 'italian-bistro-vibes');
    if (bistro) return bistro;
  }
  if (lowerTitle.includes('steak') || lowerTitle.includes('salmon') || lowerTitle.includes('dinner') || lowerTitle.includes('roast') || lowerTitle.includes('cocktail')) {
    const lounge = tracks.find(t => t.id === 'lofi-cocktail-lounge');
    if (lounge) return lounge;
  }
  if (lowerTitle.includes('pancake') || lowerTitle.includes('waffle') || lowerTitle.includes('coffee') || lowerTitle.includes('breakfast') || lowerTitle.includes('toast') || lowerTitle.includes('salad')) {
    const cafe = tracks.find(t => t.id === 'acoustic-morning-cafe');
    if (cafe) return cafe;
  }
  if (lowerTitle.includes('cookie') || lowerTitle.includes('cake') || lowerTitle.includes('bake') || lowerTitle.includes('muffin') || lowerTitle.includes('bread')) {
    const lofi = tracks.find(t => t.id === 'lofi-kitchen-chill');
    if (lofi) return lofi;
  }

  // Fallback: pick from Lo-Fi tracks
  const lofiTracks = tracks.filter(t => t.vibe === 'lofi');
  if (lofiTracks.length > 0) {
    const hash = Math.abs(hashCode(recipeTitle || 'recipe'));
    return lofiTracks[hash % lofiTracks.length];
  }

  const hash = Math.abs(hashCode(recipeTitle || 'slyde-food'));
  return tracks[hash % tracks.length];
}
