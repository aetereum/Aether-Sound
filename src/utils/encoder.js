const fs = require('node:fs');
const lamejs = require('lamejs');

/**
 * Encode Float32Array samples [-1,1] to MP3 and write to outPath.
 * @param {Float32Array|number[]} samples
 * @param {number} sampleRate
 * @param {string} outPath
 */
function encodeMp3(samples, sampleRate, outPath) {
  // Convert to Int16
  const buffer = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer[i] = s < 0 ? s * 32768 : s * 32767;
  }

  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const blockSize = 1152;
  const mp3Data = [];
  for (let i = 0; i < buffer.length; i += blockSize) {
    const chunk = buffer.subarray(i, i + blockSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) mp3Data.push(Buffer.from(mp3buf));
  }
  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) mp3Data.push(Buffer.from(endBuf));

  fs.writeFileSync(outPath, Buffer.concat(mp3Data));
  return outPath;
}

module.exports = { encodeMp3 };
