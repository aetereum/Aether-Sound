const fs = require('node:fs');
const path = require('node:path');
const { writeWav, readWav } = require('../src/utils/audio-renderer');

describe('audio-renderer basic', () => {
  const outDir = path.join(__dirname, '..', 'output');
  beforeAll(() => {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  });

  test('writeWav and readWav roundtrip', async () => {
    const samples = new Array(44100).fill(0).map((_, i) => Math.sin(2 * Math.PI * 440 * (i / 44100)));
    const fp = path.join(outDir, 'test-wav.wav');
    writeWav({ samples, sampleRate: 44100, channels: 1, filePath: fp });
    expect(fs.existsSync(fp)).toBe(true);
    const data = readWav(fp);
    expect(data).toHaveProperty('samples');
    expect(data).toHaveProperty('sampleRate', 44100);
    // Cleanup
    fs.unlinkSync(fp);
  });
});
