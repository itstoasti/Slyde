/**
 * Starter Audio Generator for Slyde
 * Generates 100% royalty-free, pleasant, harmonious 10-second musical WAV tracks
 * for TikTok, Instagram Reels, and YouTube Shorts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MUSIC_DIR = path.resolve(__dirname, '../music');

if (!fs.existsSync(MUSIC_DIR)) {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
}

function writeWavFile(filepath, durationSeconds, sampleRate, sampleGenerator) {
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk Descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // 'fmt ' Subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(byteRate, 28); // ByteRate
  buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // 'data' Subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const [left, right] = sampleGenerator(t, i, numSamples);

    const intL = Math.max(-32767, Math.min(32767, Math.round(left * 32760)));
    const intR = Math.max(-32767, Math.min(32767, Math.round(right * 32760)));

    buffer.writeInt16LE(intL, offset);
    buffer.writeInt16LE(intR, offset + 2);
    offset += 4;
  }

  fs.writeFileSync(filepath, buffer);
  console.log(`✅ Generated audio: ${path.basename(filepath)} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// Note frequencies (Hz)
const NOTES = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00
};

// 1. Lo-Fi Kitchen Chill (Warm Rhodes & Mellow Vinyl Chords: Cmaj7 - Am7 - Dm7 - G7)
function generateLofiChill() {
  const chords = [
    [NOTES.C3, NOTES.G3, NOTES.B3, NOTES.E4], // Cmaj7
    [NOTES.A3, NOTES.E4, NOTES.G4, NOTES.C5], // Am7
    [NOTES.D3, NOTES.A3, NOTES.C4, NOTES.F4], // Dm7
    [NOTES.G3, NOTES.D4, NOTES.F4, NOTES.B4]  // G7
  ];

  writeWavFile(path.join(MUSIC_DIR, 'lofi-kitchen-chill.wav'), 10.0, 44100, (t) => {
    const chordDuration = 2.5;
    const chordIndex = Math.min(chords.length - 1, Math.floor(t / chordDuration));
    const chord = chords[chordIndex];
    const chordT = t % chordDuration;

    // Soft envelope (swell + gentle decay)
    const env = Math.min(chordT / 0.15, 1.0) * Math.exp(-chordT * 0.45);

    let sample = 0;
    for (const freq of chord) {
      // Warm Rhodes-like tone: fundamental + subtle 2nd & 3rd harmonic + tremolo
      const tremolo = 1.0 + 0.15 * Math.sin(2 * Math.PI * 4.5 * t);
      const tone = Math.sin(2 * Math.PI * freq * t) * 0.5 +
                   Math.sin(2 * Math.PI * freq * 2 * t) * 0.25 +
                   Math.sin(2 * Math.PI * freq * 3 * t) * 0.1;
      sample += tone * env * tremolo;
    }

    // Gentle lo-fi vinyl warmth
    const vinyl = (Math.random() - 0.5) * 0.008;
    const left = (sample * 0.22 + vinyl);
    const right = (sample * 0.22 - vinyl);
    return [left, right];
  });
}

// 2. Acoustic Coffee Vibes (Warm Arpeggios & Woody Resonance)
function generateAcousticVibes() {
  const arpeggio = [
    NOTES.G3, NOTES.D4, NOTES.G4, NOTES.B4,
    NOTES.D4, NOTES.F4, NOTES.A4, NOTES.D5,
    NOTES.E3, NOTES.B3, NOTES.E4, NOTES.G4,
    NOTES.C3, NOTES.G3, NOTES.C4, NOTES.E4
  ];

  writeWavFile(path.join(MUSIC_DIR, 'acoustic-coffee-vibes.wav'), 10.0, 44100, (t) => {
    const noteDuration = 10.0 / arpeggio.length;
    const noteIdx = Math.min(arpeggio.length - 1, Math.floor(t / noteDuration));
    const noteT = t % noteDuration;
    const freq = arpeggio[noteIdx];

    // Pluck envelope: sharp attack, natural exponential decay
    const env = Math.min(noteT / 0.02, 1.0) * Math.exp(-noteT * 3.5);

    // Acoustic guitar harmonics (triangle-like rich timbre)
    const tone = Math.sin(2 * Math.PI * freq * noteT) * 0.5 +
                 Math.sin(2 * Math.PI * freq * 2 * noteT) * 0.3 +
                 Math.sin(2 * Math.PI * freq * 3 * noteT) * 0.15 +
                 Math.sin(2 * Math.PI * freq * 4 * noteT) * 0.05;

    const sample = tone * env * 0.3;
    // Slight stereo pan alternating per note
    const pan = 0.5 + 0.25 * Math.sin(noteIdx * 1.7);
    return [sample * (1 - pan) * 2, sample * pan * 2];
  });
}

// 3. Upbeat Cooking Groove (Energetic, Snappy Beats & Bright Chords)
function generateUpbeatGroove() {
  const beats = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.A4, NOTES.C5];

  writeWavFile(path.join(MUSIC_DIR, 'upbeat-cooking-groove.wav'), 10.0, 44100, (t) => {
    const beatT = (t * 2.2) % 1.0; // 132 BPM pulse
    const noteIdx = Math.floor(t * 1.5) % beats.length;
    const freq = beats[noteIdx];

    // Rhythmic chord hit
    const hitEnv = Math.exp(-beatT * 5.0);
    const chordTone = (Math.sin(2 * Math.PI * freq * t) +
                       Math.sin(2 * Math.PI * freq * 1.25 * t) * 0.7 +
                       Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.5) * hitEnv * 0.25;

    // Soft kick & clap pulse
    const kick = Math.sin(2 * Math.PI * (120 * Math.exp(-beatT * 15)) * t) * Math.exp(-beatT * 8) * 0.35;
    const total = chordTone + kick;

    return [total, total];
  });
}

export function generateAllStarterTracks() {
  console.log('🎵 Generating Slyde royalty-free starter audio tracks...');
  generateLofiChill();
  generateAcousticVibes();
  generateUpbeatGroove();
  console.log('✨ All starter audio tracks ready in music/ folder.');
}

// If executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAllStarterTracks();
}
