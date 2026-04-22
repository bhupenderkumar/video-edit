// ── Procedural Background Music Generator ───────────────────────────────
// Generates royalty-free music using Web Audio API.
// No external URLs needed — everything is synthesized in the browser.

export type MusicMood = "uplifting" | "corporate" | "cinematic" | "fun" | "chill" | "celebration";

interface MoodConfig {
  bpm: number;
  key: number[];       // MIDI notes for chord progression
  chords: number[][];  // chord intervals
  padOctave: number;
  bassOctave: number;
  melodyOctave: number;
  swing: number;       // 0-1
  brightness: number;  // filter frequency multiplier
  reverbDecay: number;
}

const MOOD_CONFIGS: Record<MusicMood, MoodConfig> = {
  uplifting: {
    bpm: 120, key: [60, 65, 67, 72], // C major
    chords: [[0,4,7], [5,9,12], [7,11,14], [0,4,7]],
    padOctave: 4, bassOctave: 2, melodyOctave: 5,
    swing: 0, brightness: 1.2, reverbDecay: 1.5,
  },
  corporate: {
    bpm: 110, key: [62, 66, 69, 74], // D major
    chords: [[0,4,7], [5,9,12], [2,5,9], [7,11,14]],
    padOctave: 4, bassOctave: 2, melodyOctave: 5,
    swing: 0, brightness: 0.9, reverbDecay: 2.0,
  },
  cinematic: {
    bpm: 80, key: [57, 60, 64, 67], // A minor
    chords: [[0,3,7], [5,8,12], [3,7,10], [0,3,7]],
    padOctave: 3, bassOctave: 2, melodyOctave: 5,
    swing: 0, brightness: 0.6, reverbDecay: 3.0,
  },
  fun: {
    bpm: 135, key: [64, 67, 71, 76], // E major
    chords: [[0,4,7], [5,9,12], [7,11,14], [2,5,9]],
    padOctave: 4, bassOctave: 3, melodyOctave: 5,
    swing: 0.15, brightness: 1.4, reverbDecay: 1.0,
  },
  chill: {
    bpm: 85, key: [60, 63, 67, 70], // C minor 7
    chords: [[0,3,7,10], [5,8,12,15], [3,7,10,14], [0,3,7,10]],
    padOctave: 4, bassOctave: 2, melodyOctave: 5,
    swing: 0.2, brightness: 0.7, reverbDecay: 2.5,
  },
  celebration: {
    bpm: 140, key: [65, 69, 72, 77], // F major
    chords: [[0,4,7], [5,9,12], [7,11,14], [0,4,7]],
    padOctave: 4, bassOctave: 3, melodyOctave: 5,
    swing: 0.1, brightness: 1.3, reverbDecay: 1.2,
  },
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Generate background music as an AudioBuffer.
 * duration: seconds of music to generate.
 * mood: style/feel of the music.
 */
export async function generateMusic(
  audioCtx: AudioContext,
  duration: number,
  mood: MusicMood = "uplifting"
): Promise<AudioBuffer> {
  const config = MOOD_CONFIGS[mood] || MOOD_CONFIGS.uplifting;
  const sampleRate = audioCtx.sampleRate;
  const totalSamples = Math.ceil(sampleRate * duration);
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const beatDuration = 60 / config.bpm;
  const barDuration = beatDuration * 4;
  const totalBars = Math.ceil(duration / barDuration);

  // Simple reverb simulation via feedback delay
  const delayLen = Math.round(sampleRate * 0.03);
  const reverbLen = Math.round(sampleRate * config.reverbDecay);
  const reverbBuf = new Float32Array(reverbLen);
  let reverbIdx = 0;
  const reverbMix = 0.15;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const barProgress = (t % barDuration) / barDuration;
    const currentBar = Math.floor(t / barDuration);
    const chordIdx = currentBar % config.chords.length;
    const chord = config.chords[chordIdx];
    const beatInBar = Math.floor(barProgress * 4);

    let sample = 0;

    // ── Pad (sustained chords) ──────────────────────────
    const padVol = 0.06;
    for (const interval of chord) {
      const freq = midiToFreq(config.key[0] + interval);
      // Soft triangle-ish wave
      const phase = (t * freq) % 1;
      const tri = 4 * Math.abs(phase - 0.5) - 1;
      sample += tri * padVol;
    }

    // ── Bass ────────────────────────────────────────────
    const bassNote = config.key[0] + chord[0] - 24; // 2 octaves below
    const bassFreq = midiToFreq(bassNote);
    const bassPhase = (t * bassFreq) % 1;
    // Bass plays on beats 0, 2
    const bassEnv = (beatInBar === 0 || beatInBar === 2)
      ? Math.max(0, 1 - ((barProgress * 4 - beatInBar) / 0.8))
      : 0;
    sample += (bassPhase < 0.5 ? 1 : -1) * 0.08 * bassEnv; // square bass

    // ── Hi-hat pattern ──────────────────────────────────
    const eighthNote = Math.floor(barProgress * 8);
    const eighthProgress = (barProgress * 8) % 1;
    const hatEnv = Math.max(0, 1 - eighthProgress * 8);
    // Noise-based hi-hat
    const noise = Math.sin(i * 12.9898 + 78.233) * 43758.5453 % 1;
    const hatVol = (eighthNote % 2 === 0) ? 0.025 : 0.012;
    sample += noise * hatVol * hatEnv;

    // ── Kick drum (beat 0, 2) ───────────────────────────
    if (beatInBar === 0 || beatInBar === 2) {
      const kickT = (barProgress * 4 - beatInBar) * beatDuration;
      if (kickT >= 0 && kickT < 0.15) {
        const kickFreq = 60 * Math.exp(-kickT * 30); // pitch drops
        const kickEnv = Math.exp(-kickT * 25);
        sample += Math.sin(2 * Math.PI * kickFreq * kickT) * 0.12 * kickEnv;
      }
    }

    // ── Simple melody (every 2 bars, 4 notes) ───────────
    if (currentBar % 2 === 0) {
      const melodyNotes = [chord[0], chord[1] || chord[0] + 4, chord[2] || chord[0] + 7, chord[1] || chord[0] + 4];
      const melodyIdx = Math.floor(barProgress * 4);
      const melodyNote = config.key[0] + melodyNotes[melodyIdx] + 12; // octave up
      const melodyFreq = midiToFreq(melodyNote);
      const melodyPhase = (t * melodyFreq) % 1;
      const melodyEnv = Math.max(0, 1 - ((barProgress * 4 - melodyIdx) / 0.6));
      // Soft sine melody
      sample += Math.sin(2 * Math.PI * melodyPhase) * 0.04 * melodyEnv;
    }

    // ── Simple reverb ───────────────────────────────────
    const reverbSample = reverbBuf[(reverbIdx + reverbLen - delayLen) % reverbLen] || 0;
    const wet = sample + reverbSample * reverbMix;
    reverbBuf[reverbIdx % reverbLen] = sample * 0.3 + reverbSample * 0.4;
    reverbIdx++;

    // Fade in/out
    const fadeIn = Math.min(1, t / 1.5);
    const fadeOut = Math.min(1, (duration - t) / 2.0);
    const envelope = fadeIn * fadeOut;

    const finalSample = wet * envelope * 0.7;

    // Slight stereo width
    left[i] = finalSample * 1.05;
    right[i] = finalSample * 0.95;
  }

  return buffer;
}

/**
 * Map an AI mood suggestion string to a MusicMood.
 */
export function mapMoodToType(moodStr: string): MusicMood {
  const m = moodStr.toLowerCase();
  const map: Record<string, MusicMood> = {
    uplifting: "uplifting", happy: "uplifting", cheerful: "fun", playful: "fun",
    professional: "corporate", corporate: "corporate", inspiring: "corporate",
    dramatic: "cinematic", cinematic: "cinematic", emotional: "cinematic",
    relaxed: "chill", calm: "chill", lofi: "chill", "lo-fi": "chill",
    festive: "celebration", celebration: "celebration", energetic: "celebration",
    fun: "fun", exciting: "fun",
  };
  return map[m] || "uplifting";
}

export const MUSIC_MOODS: { id: MusicMood; name: string; description: string }[] = [
  { id: "uplifting", name: "Uplifting", description: "Bright, positive energy" },
  { id: "corporate", name: "Corporate", description: "Professional, clean" },
  { id: "cinematic", name: "Cinematic", description: "Dramatic, emotional" },
  { id: "fun", name: "Fun & Playful", description: "Energetic, bouncy" },
  { id: "chill", name: "Chill Lo-Fi", description: "Relaxed, laid back" },
  { id: "celebration", name: "Celebration", description: "Festive, upbeat" },
];
