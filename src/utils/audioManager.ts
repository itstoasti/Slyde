export interface AudioVibeOption {
  id: 'auto' | 'lofi' | 'acoustic' | 'upbeat';
  name: string;
  description: string;
  emoji: string;
}

export const AUDIO_VIBE_PRESETS: AudioVibeOption[] = [
  {
    id: 'auto',
    name: 'Auto-Rotate / Shuffle',
    description: 'Cycles seamlessly through all available music tracks in your music/ folder',
    emoji: '🎲'
  },
  {
    id: 'lofi',
    name: 'Cozy Lo-Fi Kitchen',
    description: 'Mellow, relaxed chords with warm Rhodes piano aesthetics',
    emoji: '☕'
  },
  {
    id: 'acoustic',
    name: 'Acoustic Coffee Vibes',
    description: 'Warm fingerpicked acoustic guitar arpeggios & woody resonance',
    emoji: '🎸'
  },
  {
    id: 'upbeat',
    name: 'Upbeat Cooking Groove',
    description: 'Energetic, cheerful culinary beats with bright funky stabs',
    emoji: '🍳'
  }
];

export interface AudioTrackInfo {
  filename: string;
  vibe: string;
}

export async function fetchAudioTracks(): Promise<AudioTrackInfo[]> {
  try {
    const res = await fetch('/api/audio-tracks');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tracks)) {
        return data.tracks;
      }
    }
  } catch (e) {}
  return [
    { filename: 'lofi-kitchen-chill.wav', vibe: 'lofi' },
    { filename: 'acoustic-coffee-vibes.wav', vibe: 'acoustic' },
    { filename: 'upbeat-cooking-groove.wav', vibe: 'upbeat' }
  ];
}
