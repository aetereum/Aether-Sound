const path = require('node:path');
const { writeWav } = require('../utils/audio-renderer');

function noteToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

async function generateRandomMelody({ outputDir, lengthSec = 6 }) {
  const sr = 44100;
  const total = Math.floor(lengthSec * sr);
  const samples = new Array(total).fill(0);

  const baseNotes = [60, 62, 64, 65, 67, 69, 71]; // C major-ish
  for (let i = 0; i < Math.floor(lengthSec); i++) {
    const note = baseNotes[Math.floor(Math.random() * baseNotes.length)];
    const freq = noteToFreq(note);
    const dur = 0.5 + Math.random() * 0.5;
    const start = Math.floor(i * sr);
    for (let n = 0; n < Math.floor(dur * sr); n++) {
      const t = n / sr;
      const idx = start + n;
      if (idx >= total) break;
      samples[idx] += 0.5 * Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 2);
    }
  }

  const filePath = path.join(outputDir, `random_melody_${Date.now()}.wav`);
  writeWav({ samples, sampleRate: sr, channels: 1, filePath });
  return filePath;
}

module.exports = { generateRandomMelody };
