const fs = require('node:fs');
const path = require('node:path');
const generateCreativeMusic = require('../src/generators/creative-generator');
const { generateRandomMelody } = require('../src/generators/random-melody-generator');

describe('generators smoke', () => {
  const outDir = path.join(__dirname, '..', 'output');
  beforeAll(() => {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  });

  test('generateRandomMelody produces a file', async () => {
    const fp = await generateRandomMelody({ outputDir: outDir, lengthSec: 1 });
    expect(fs.existsSync(fp)).toBe(true);
    fs.unlinkSync(fp);
  });

  test('generateCreativeMusic produces a file', async () => {
    const res = await generateCreativeMusic({ outputDir: outDir, lengthSec: 1 });
    const fp = res.filePath || res;
    expect(fs.existsSync(fp)).toBe(true);
    fs.unlinkSync(fp);
  });
});
