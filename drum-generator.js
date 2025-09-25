const path = require('path');
const { writeWav } = require('./audio-renderer');

function click(t, freq) {
  // breve impulso con decaimiento
  const env = Math.exp(-t * 60);
  return env * Math.sin(2 * Math.PI * freq * t);
}

async function generateDrums({ outputDir, durationSec = 4 }) {
  const sr = 44100;
  const total = Math.floor(durationSec * sr);
  const samples = new Array(total).fill(0);

  const bpm = 100;
  const beat = 60 / bpm;

  for (let i = 0; i < durationSec / beat; i++) {
    const t0 = i * beat;
    // Kick on every beat
    for (let n = 0; n < Math.floor(0.2 * sr); n++) {
      const t = n / sr;
      const idx = Math.floor((t0 + t) * sr);
      if (idx >= total) break;
      samples[idx] += 0.8 * click(t, 60);
    }
    // Snare on 2 and 4
    if (i % 2 === 1) {
      for (let n = 0; n < Math.floor(0.15 * sr); n++) {
        const t = n / sr;
        const idx = Math.floor((t0 + t) * sr);
        if (idx >= total) break;
        samples[idx] += 0.6 * click(t, 180);
      }
    }
    // Hi-hat eighths
    const hhInterval = beat / 2;
    for (let h = 0; h < 2; h++) {
      const hhT0 = t0 + h * hhInterval;
      for (let n = 0; n < Math.floor(0.05 * sr); n++) {
        const t = n / sr;
        const idx = Math.floor((hhT0 + t) * sr);
        if (idx >= total) break;
        samples[idx] += 0.3 * click(t, 4000);
      }
    }
  }

  const filePath = path.join(outputDir, 'drum-beat.wav');
  writeWav({ samples, sampleRate: sr, channels: 1, filePath });
  return filePath;
}

module.exports = { generateDrums };