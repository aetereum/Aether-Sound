const path = require('node:path');
const { writeWav } = require('../utils/audio-renderer');

function sine(freq, t, sr) {
  return Math.sin(2 * Math.PI * freq * t);
}

function envelope(t, duration) {
  const attack = 0.01 * duration;
  const release = 0.05 * duration;
  if (t < attack) return t / attack;
  if (t > duration - release) return Math.max(0, (duration - t) / release);
  return 1.0;
}

function noteToFreq(note) {
  // A4=440, note as MIDI number
  return 440 * Math.pow(2, (note - 69) / 12);
}

const KEY_TO_SEMITONE = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  minor: [0, 2, 3, 5, 7, 8, 10, 12]
};

function buildScaleMidi({ key = 'C', scale = 'major', octave = 5 }) {
  const root = (KEY_TO_SEMITONE[key] ?? 0) + 12 * octave; // C5=60
  const intervals = SCALE_INTERVALS[scale] || SCALE_INTERVALS.major;
  return intervals.map(semi => 60 + (KEY_TO_SEMITONE[key] ?? 0) + semi); // around C5 region
}

async function generateComposition({ outputDir, bpm = 100, key = 'C', scale = 'major', durationSec }) {
  const sr = 44100;
  const beatDur = 60 / bpm;
  const totalDuration = durationSec || Math.max(4, Math.min(20, 8 * beatDur)); // entre 4s y 20s aprox
  const totalSamples = Math.floor(totalDuration * sr);
  const samples = new Array(totalSamples).fill(0);

  const melodyScale = buildScaleMidi({ key, scale, octave: 5 });
  const bassRoot = 36 + (KEY_TO_SEMITONE[key] ?? 0); // C2 base + key offset

  const notesCount = Math.floor(totalDuration / beatDur);
  for (let i = 0; i < notesCount; i++) {
    const t0 = i * beatDur;
    const mNote = melodyScale[i % melodyScale.length];
    const bNote = (i % 2 === 0) ? bassRoot : bassRoot + 7; // tónica/quinta
    const mFreq = noteToFreq(mNote);
    const bFreq = noteToFreq(bNote);

    for (let n = 0; n < Math.floor(beatDur * sr); n++) {
      const t = n / sr;
      const idx = Math.floor((t0 + t) * sr);
      if (idx >= totalSamples) break;
      const m = 0.35 * sine(mFreq, t, sr) * envelope(t, beatDur);
      const b = 0.3 * sine(bFreq, t, sr) * envelope(t, beatDur);
      samples[idx] += m + b;
    }
  }

  const filePath = path.join(outputDir, 'melody-with-bass.wav');
  writeWav({ samples, sampleRate: sr, channels: 1, filePath });
  return filePath;
}

module.exports = { generateComposition };
