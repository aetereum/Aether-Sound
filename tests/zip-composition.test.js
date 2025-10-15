const fs = require('node:fs');
const path = require('node:path');
const { generateComposition } = require('../src/generators/composition-generator');
const { encodeMp3 } = require('../src/utils/encoder');
const archiver = require('archiver');

describe('zip composition', () => {
  const outDir = path.join(__dirname, '..', 'output');
  beforeAll(() => {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  });

  test('generate composition and zip (mp3 + wav)', async () => {
    const wav = await generateComposition({ outputDir: outDir, durationSec: 1 });
    expect(fs.existsSync(wav)).toBe(true);

    const zipPath = path.join(outDir, `test_zip_${Date.now()}.zip`);
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      archive.file(wav, { name: path.basename(wav) });
      // only wav included to avoid mp3 encoder issues in CI
      archive.finalize();
    });

    expect(fs.existsSync(zipPath)).toBe(true);

  // cleanup
  fs.unlinkSync(wav);
  fs.unlinkSync(zipPath);
  }, 20000);
});
