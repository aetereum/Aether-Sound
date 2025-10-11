const path = require("node:path");
const { writeWav } = require("../utils/audio-renderer");

function saw(freq, t) {
  const p = (t * freq) % 1;
  return 2 * p - 1; // -1..1
}

function adsr(t, noteDur, a = 0.01, d = 0.05, s = 0.7, r = 0.2) {
  if (t < 0) return 0;
  if (t < a) return t / a; // attack up to 1
  if (t < a + d) {
    const u = (t - a) / d;
    return 1 - (1 - s) * u; // decay to sustain
  }
  if (t < noteDur) return s; // sustain
  const rt = t - noteDur;
  if (rt < r) return s * (1 - rt / r); // release
  return 0;
}

function noteToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

async function generateSynth({ outputDir, durationSec = 5 }) {
  const sr = 44100;
  const total = Math.floor(durationSec * sr);
  const samples = new Array(total).fill(0);

  // Acorde C major: C4-E4-G4
  const notes = [60, 64, 67].map(noteToFreq);
  const noteDur = durationSec - 0.5;

  for (let n = 0; n < total; n++) {
    const t = n / sr;
    let v = 0;
    for (const f of notes) {
      v += saw(f, t);
    }
    v /= notes.length; // promedio
    const env = adsr(t, noteDur, 0.02, 0.1, 0.6, 0.4);
    samples[n] = 0.7 * v * env;
  }

  const filePath = path.join(outputDir, "simple-synth.wav");
  writeWav({ samples, sampleRate: sr, channels: 1, filePath });
  return filePath;
}

module.exports = { generateSynth };

if (require.main === module) {
  const outDir = path.join(__dirname, "output");
  generateSynth({ outputDir: outDir })
    .then((fp) => {
      console.log("Generado:", fp);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
