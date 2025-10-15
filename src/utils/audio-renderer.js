const fs = require("node:fs");
const path = require("node:path");
const WaveFile = require("wavefile").WaveFile;
const logger = require("./logger");

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

/**
 * Genera una onda sinusoidal simple para una frecuencia y duración dadas.
 * @param {number} freq Frecuencia en Hz.
 * @param {number} duration Duración en segundos.
 * @param {number} sampleRate Tasa de muestreo.
 * @returns {Float32Array}
 */
function createSineWave(freq, duration, sampleRate) {
  const numSamples = Math.floor(duration * sampleRate);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = Math.sin(2 * Math.PI * freq * (i / sampleRate));
  }
  return samples;
}

/**
 * Convierte una nota MIDI a frecuencia en Hz.
 * @param {number} midi Nota MIDI (0-127).
 * @returns {number} Frecuencia en Hz.
 */
function midiToFreq(midi) {
  return Math.pow(2, (midi - 69) / 12) * 440;
}

/**
 * Renderiza un conjunto de notas a un archivo de audio WAV.
 * @param {object} notes Objeto con arrays de notas para 'melody', 'bass', 'chords'.
 * @param {string} outputPath Ruta del archivo de salida.
 * @param {number} duration Duración total en segundos.
 * @param {number} tempo Tempo en BPM (no se usa directamente aquí, pero es bueno tenerlo).
 * @param {number} sampleRate Tasa de muestreo.
 */
async function renderAudio(notes, outputPath, duration, _tempo = 120, sampleRate = 44100) {
  logger.info(`Iniciando renderización de audio a: ${outputPath}`);
  const totalSamples = Math.floor(duration * sampleRate);
  const finalMix = new Float32Array(totalSamples).fill(0);

  // Combina todas las partes en un solo array de notas
  const allNotes = [
    ...(notes.melody || []),
    ...(notes.bass || []),
    ...(notes.chords || []),
  ];

  for (const note of allNotes) {
    // Manejar tanto notas individuales (número) como acordes (array de números)
    const pitches = Array.isArray(note.pitch) ? note.pitch : [note.pitch];
    
    for (const pitch of pitches) {
      const freq = midiToFreq(pitch);
      const noteSamples = createSineWave(freq, note.duration, sampleRate);
      const startSample = Math.floor(note.time * sampleRate);

      for (let i = 0; i < noteSamples.length; i++) {
        const mixIndex = startSample + i;
        if (mixIndex < totalSamples) {
          // Mezclar aditivamente, reduciendo el volumen para evitar clipping
          finalMix[mixIndex] += noteSamples[i] * (note.velocity || 0.5) * 0.25;
        }
      }
    }
  }

  writeWav({ samples: Array.from(finalMix), filePath: outputPath, sampleRate });
  logger.info(`Audio renderizado correctamente en: ${outputPath}`);
}

module.exports = { writeWav, readWav, renderAudio };
