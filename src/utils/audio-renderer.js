const fs = require("node:fs");
const path = require("node:path");
const WaveFile = require("wavefile").WaveFile;

function writeWav({
  samples,
  sampleRate = 44100,
  channels = 1,
  bitDepth = 16,
  filePath,
}) {
  if (!Array.isArray(samples))
    throw new Error("samples debe ser un array de Float32");
  if (!filePath) throw new Error("filePath es requerido");

  // Normalizar y convertir a Int16
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    int16[i] = Math.max(
      -32768,
      Math.min(32767, Math.round(clamp(samples[i]) * 32767)),
    );
  }

  const wav = new WaveFile();
  wav.fromScratch(channels, sampleRate, `${bitDepth}`, int16);

  const buf = Buffer.from(wav.toBuffer());
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, buf);
  return filePath;
}

function readWav(filePath) {
  if (!filePath) throw new Error("filePath es requerido");
  const buf = fs.readFileSync(filePath);
  const wav = new WaveFile(buf);
  const sampleRate = wav.fmt.sampleRate;
  const numChannels = wav.fmt.numChannels;
  // Obtener muestras de-intreleaved por canal como Int16 y convertir a Float32 [-1,1]
  const channelsData = wav.getSamples(false, Int16Array);
  let mono;
  if (Array.isArray(channelsData)) {
    const length = channelsData[0].length;
    mono = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let ch = 0; ch < channelsData.length; ch++)
        sum += channelsData[ch][i];
      mono[i] = sum / channelsData.length / 32768;
    }
  } else {
    // Si por alguna razón viene entrelazado
    const inter = channelsData;
    const frames = Math.floor(inter.length / numChannels);
    mono = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      let sum = 0;
      for (let ch = 0; ch < numChannels; ch++)
        sum += inter[i * numChannels + ch];
      mono[i] = sum / numChannels / 32768;
    }
  }
  return { samples: Array.from(mono), sampleRate };
}

module.exports = { writeWav, readWav };
