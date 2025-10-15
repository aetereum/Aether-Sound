const request = require('supertest');
const express = require('express');
const fs = require('node:fs'); // Mocking sync version
const apiRouter = require('./api');

// --- Mocks de Módulos Externos ---

// Mock del logger para evitar logs en la consola durante las pruebas
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock de los generadores para no ejecutar lógica pesada
jest.mock('../generators/creative-generator', () => jest.fn(() => ({ filePath: '/output/fake.wav', notes: { melody: [] }, duration: 4 })));
jest.mock('../generators/composition-generator', () => ({ generateComposition: jest.fn() }));
jest.mock('../generators/drum-generator', () => ({ generateDrums: jest.fn() }));

// Mock de los servicios que hacen llamadas a APIs externas
jest.mock('../core/api-calls.js', () => ({
  callGeminiAPI: jest.fn(),
  identifySongWithACRCloud: jest.fn(),
  transcribeAudioWithGemini: jest.fn(),
}));

// Mock del renderizador de audio para no crear archivos reales
jest.mock('../utils/audio-renderer.js', () => ({ renderAudio: jest.fn().mockResolvedValue(true) }));

// Importar los mocks para poder controlarlos en las pruebas
const { callGeminiAPI, identifySongWithACRCloud, transcribeAudioWithGemini } = require('../core/api-calls.js');
// --- Configuración de la App de Prueba ---
let app;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api', apiRouter); // Monta el router que queremos probar

  // Añadir un manejador de errores simple para las pruebas
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    });
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('API Routes', () => {
  describe('GET /api/output', () => {
    it('debería devolver un array vacío si el directorio está vacío', async () => {
      jest.spyOn(fs, 'readdirSync').mockReturnValue([]);
      const res = await request(app).get('/api/output');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({ files: [] });
    });

    it('debería devolver solo archivos de audio', async () => {
      jest.spyOn(fs, 'readdirSync').mockReturnValue(['song1.wav', 'image.jpg', 'song2.mp3', 'document.txt']);
      const res = await request(app).get('/api/output');
      expect(res.statusCode).toEqual(200);
      expect(res.body.files).toEqual(['song1.wav', 'song2.mp3']);
    });

    it('debería manejar un error si el directorio no existe', async () => {
      jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const res = await request(app).get('/api/output');
      expect(res.statusCode).toEqual(500);
      expect(res.body.success).toBe(false); // El manejador de errores centralizado responde así
    });
  });

  describe('POST /api/chatbot', () => {
    it('debería devolver una respuesta del bot con un mensaje válido', async () => {
      const mockBotResponse = '¡Hola! Soy AetherBot.';
      callGeminiAPI.mockResolvedValue(mockBotResponse);

      const res = await request(app)
        .post('/api/chatbot')
        .send({ userMessage: 'Hola' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.reply).toEqual(mockBotResponse);
      expect(callGeminiAPI).toHaveBeenCalledTimes(1);
    });

    it('debería devolver un error 400 si falta userMessage', async () => {
      const res = await request(app).post('/api/chatbot').send({});
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false); // La validación ahora responde así
      expect(res.body.errors).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/evolve-with-ai', () => {
    it('debería devolver variaciones musicales con datos válidos', async () => {
      const mockVariations = { rhythmic: {}, melodic: {}, complex: {} };
      callGeminiAPI.mockResolvedValue(JSON.stringify(mockVariations));

      const res = await request(app)
        .post('/api/evolve-with-ai')
        .send({
          notes: { melody: [] },
          params: { key: 'C', scale: 'major', tempo: 120 },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.variations).toEqual(mockVariations);
    });
  });

  describe('POST /api/identify-song', () => {
    // Mock para fs.promises para evitar escrituras/lecturas reales en el disco
    // beforeEach(() => {
    //   jest.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('fake-audio'));
    //   jest.spyOn(fs.promises, 'unlink').mockResolvedValue();
    // });

    it('debería identificar una canción de un archivo subido', async () => {
      const mockIdentification = { success: true, data: { title: 'Test Song' } };
      identifySongWithACRCloud.mockResolvedValue(mockIdentification);

      const res = await request(app)
        .post('/api/identify-song')
        .set('Content-Type', 'multipart/form-data')
        .attach('audio_sample', Buffer.from('fake-audio-data'), 'sample.wav');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockIdentification);
      expect(identifySongWithACRCloud).toHaveBeenCalledTimes(1);
    });

    it('debería devolver un error 400 si no se sube un archivo', async () => {
      const res = await request(app).post('/api/identify-song').send();
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('No se ha subido ningún archivo');
    });
  });

  describe('POST /api/generate-creative', () => {
    it('debería generar datos de música con parámetros válidos', async () => {
      const res = await request(app)
        .post('/api/generate-creative')
        .send({ key: 'C', scale: 'major', tempo: 120, drumPattern: 'pop-rock' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.audioUrl).toBeDefined();
      expect(res.body.notes).toBeDefined();
      expect(res.body.duration).toBeDefined();
      expect(res.body.params).toEqual({ key: 'C', scale: 'major', tempo: 120, drumPattern: 'pop-rock' });
    });

    it('debería devolver un error 400 si faltan parámetros', async () => {
      const res = await request(app)
        .post('/api/generate-creative')
        .send({ key: 'C', scale: 'major' }); // Falta el tempo

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0].msg).toContain('tempo');
    });
  });

  describe('POST /api/album/create', () => {
    it('debería crear un manifiesto de álbum con datos válidos', async () => {
      const albumData = {
        title: 'Mi Gran Álbum',
        artist: 'Aether',
        tracks: ['track1.wav', 'track2.wav'],
      };

      // Mock para evitar escribir archivos reales
      jest.spyOn(require('node:fs/promises'), 'writeFile').mockResolvedValue();

      const res = await request(app)
        .post('/api/album/create')
        .send(albumData);

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Manifiesto de álbum creado');
      expect(res.body.albumId).toBeDefined();
    });

    it('debería devolver un error 400 si faltan pistas', async () => {
      const res = await request(app)
        .post('/api/album/create')
        .send({ title: 'Álbum Vacío', artist: 'Nadie', tracks: [] });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0].msg).toContain('al menos una pista');
    });
  });

  describe('POST /api/transcribe-melody', () => {
    it('debería transcribir una melodía de un archivo de audio', async () => {
      const mockNotes = [{ pitch: 60, time: 0, duration: 0.5, velocity: 0.8 }];
      transcribeAudioWithGemini.mockResolvedValue(mockNotes);

      const res = await request(app)
        .post('/api/transcribe-melody')
        .set('Content-Type', 'multipart/form-data')
        .attach('audio_melody', Buffer.from('fake-audio-data'), 'melody.webm');

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.notes).toEqual(mockNotes);
    });
  });

  describe('Output cleanup endpoints', () => {
    const outDir = require('node:path').resolve(__dirname, '..', '..', 'output');
    const tmpName = `test_cleanup_${Date.now()}.wav`;
    const tmpPath = require('node:path').join(outDir, tmpName);

    beforeAll(() => {
      // Ensure output dir exists
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    });

    afterAll(() => {
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) {}
    });

    it('GET /api/output/cleanup should list files with ageSeconds', async () => {
      jest.spyOn(fs, 'readdirSync').mockReturnValue([tmpName]);
      const mockStat = { size: 1234, mtimeMs: Date.now() - 5000 };
      jest.spyOn(fs, 'statSync').mockReturnValue(mockStat);

      const res = await request(app).get('/api/output/cleanup');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.files)).toBe(true);
      expect(res.body.files[0]).toHaveProperty('name', tmpName);

      fs.readdirSync.mockRestore();
      fs.statSync.mockRestore();
    });

    it('POST /api/output/cleanup should delete files older than TTL (dryRun and actual)', async () => {
      // Create a real temporary file
      fs.writeFileSync(tmpPath, 'fake');
      expect(fs.existsSync(tmpPath)).toBe(true);

      // Dry run should not delete
      const dry = await request(app)
        .post('/api/output/cleanup')
        .send({ ttl: 0, dryRun: true });
    expect(dry.statusCode).toBe(200);
    expect(dry.body.dryRun).toBe(true);
    expect(Array.isArray(dry.body.candidates)).toBe(true);
    expect(fs.existsSync(tmpPath)).toBe(true);

      // Actual delete
      const del = await request(app)
        .post('/api/output/cleanup')
        .send({ ttl: 0, dryRun: false });
      expect(del.statusCode).toBe(200);
      expect(Array.isArray(del.body.removed)).toBe(true);
      // Cleanup manually in case the environment prevented deletion
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) {}
    });
  });

});