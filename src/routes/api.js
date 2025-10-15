const express = require("express");
const { body, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("node:path");
const fs = require("node:fs");
const fsp = fs.promises;
const { Midi } = require("@tonejs/midi");

const config = require("../config");
const logger = require("../utils/logger");
const {
  callGeminiAPI,
  identifySongWithACRCloud,
  transcribeAudioWithGemini,
} = require("../core/api-calls.js");
const { chatbotSystemPrompt, evolutionSystemPrompt } = require("../utils/prompts.js");
const generateCreativeMusic = require("../generators/creative-generator.js");
const { generateRandomMelody } = require("../generators/random-melody-generator.js");
const { renderAudio } = require("../utils/audio-renderer.js");
const { generateComposition } = require("../generators/composition-generator.js");
const { generateSynth } = require("../generators/render-simple-synth.js");
const { encodeMp3 } = require('../utils/encoder');
const ffmpeg = require('../utils/ffmpeg');
const archiver = require('archiver');

const router = express.Router();

// Wrapper para rutas asíncronas
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware para manejar errores de validación de express-validator
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// Configuración de Multer para subida de archivos
const upload = multer({
  // Corregido: La ruta debe ser relativa a la raíz del proyecto, no a __dirname
  dest: path.resolve(__dirname, "..", "..", "uploads"),
});

// --- RUTAS ---

// Middleware para proteger rutas internas (opcional): usa config.apiKeys.internal si está configurada
const requireInternalApiKey = (req, res, next) => {
  const provided = req.headers['x-api-key'] || req.body?.apiKey || req.query?.apiKey;
  if (config.apiKeys && config.apiKeys.internal) {
    if (!provided || provided !== config.apiKeys.internal) {
      return res.status(401).json({ success: false, message: 'Unauthorized: invalid API key' });
    }
  } else {
    // Si no hay clave interna configurada, permitir la operación pero advertir en logs.
    logger.warn('No internal API key configured (AETHER_SOUND_API_KEY). Cleanup endpoint is unprotected.');
  }
  next();
};

// Identificar canción
router.post(
  "/identify-song",
  upload.single("audio_sample"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No se ha subido ningún archivo de audio." }); // Respuesta consistente
    }
    const filePath = req.file.path;
    try {
      const audioBuffer = await fsp.readFile(filePath);
      const identificationResult = await identifySongWithACRCloud(audioBuffer);
      res.json(identificationResult);
    } finally {
      // Mejorado: Usar warn para errores no críticos y asegurar la limpieza.
      await fsp.unlink(filePath).catch(e => 
        logger.warn(`No se pudo limpiar el archivo temporal en ${filePath}: ${e.message}`));
    }
  }),
);

// Listar archivos de salida
router.get("/output", (req, res, next) => {
  try {
    const outputDir = path.resolve(__dirname, "..", "..", "output"); // Corregido
    const files = fs
      .readdirSync(outputDir)
      .filter((f) => f.endsWith(".wav") || f.endsWith(".mp3") || f.endsWith(".ogg"));
    res.json({ files });
  } catch (err) {
    next(err);
  }
});

// Lista detallada con tiempos de modificación (útil para decidir limpieza)
router.get('/output/cleanup', requireInternalApiKey, (req, res, next) => {
  try {
    const outputDir = path.resolve(__dirname, '..', '..', 'output');
    const files = fs.readdirSync(outputDir).map((f) => {
      const st = fs.statSync(path.join(outputDir, f));
      return {
        name: f,
        size: st.size,
        mtime: st.mtimeMs,
        ageSeconds: Math.floor((Date.now() - st.mtimeMs) / 1000),
      };
    });
    res.json({ success: true, files });
  } catch (err) {
    next(err);
  }
});

// POST /output/cleanup - eliminar archivos más antiguos que TTL (en segundos). Opcional: ?dryRun=true
router.post('/output/cleanup', requireInternalApiKey, asyncHandler(async (req, res) => {
  const ttlSeconds = Number(req.body.ttl || req.query.ttl || 24 * 3600); // default 24h
  const dryRun = req.body.dryRun === true || req.query.dryRun === 'true';
  const allowedExt = ['.wav', '.mp3', '.ogg', '.zip', '.json'];

  const outputDir = path.resolve(__dirname, '..', '..', 'output');
  const now = Date.now();
  const removed = [];
  const candidates = [];

  const files = await fsp.readdir(outputDir);
  for (const f of files) {
    const full = path.join(outputDir, f);
    const st = await fsp.stat(full);
    if (!st.isFile()) continue;
    if (!allowedExt.includes(path.extname(f).toLowerCase())) continue;
    const age = Math.floor((now - st.mtimeMs) / 1000);
    if (age >= ttlSeconds) {
      candidates.push({ name: f, path: full, ageSeconds: age });
      if (!dryRun) {
        await fsp.unlink(full).catch((e) => logger.warn(`No se pudo borrar ${full}: ${e.message}`));
        removed.push(f);
      }
    }
  }

  res.json({ success: true, dryRun, ttlSeconds, removed, candidates });
}));

// Efecto de Pitch Shift (placeholder con validación)
router.post(
  "/effects/pitch-shift",
  [
    body("file").isString().notEmpty().withMessage("El parámetro 'file' es requerido y debe ser un string."),
    body("semitones").isNumeric().withMessage("El parámetro 'semitones' debe ser un número."),
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { file, semitones } = req.body;
    const outDir = path.resolve(__dirname, "..", "..", "output"); // Corregido
    const src = path.join(outDir, file);
    await fsp.access(src); // Verifica si el archivo existe, lanza error si no
    const targetName = `${path.parse(file).name}_ps${semitones}${path.extname(file)}`;
    const target = path.join(outDir, targetName);
    await fsp.copyFile(src, target);
    return res.json({ success: true, file: targetName }); // Estandarizado
  }),
);

// Chatbot
router.post(
  "/chatbot",
  [body("userMessage").isString().notEmpty().withMessage("El 'userMessage' es requerido.")], // Validación
  [body("apiKey").optional().isString()], // Aceptar una API Key opcional desde el cliente
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { userMessage, apiKey } = req.body;
    const chatbotApiKey = apiKey || config.apiKeys.chatbot; // Priorizar la clave del cliente

    if (!chatbotApiKey) {
      logger.error("Falta la clave API del chatbot en el servidor (AETHER_CHATBOT_API_KEY).");
      return res.status(400).json({ // 400 es más apropiado si la clave la provee el usuario
        success: false,
        message: "La API Key para el chatbot no está configurada. Por favor, añádela en los Ajustes.",
      });
    }

    const botResponse = await callGeminiAPI(
      chatbotApiKey, `${chatbotSystemPrompt} "${userMessage}"`
    );
    const cleanResponse = botResponse.replace(/[*#]/g, "").trim();

    if (!cleanResponse) {
      return res.json({
        success: true, // La petición fue exitosa, aunque la IA no dio una respuesta útil
        reply: "No he podido procesar esa pregunta. ¿Puedes intentar reformularla? 🤔",
      });
    }
    res.json({ reply: cleanResponse });
  }),
);

// Renderizar música desde datos de notas
router.post(
  "/render-music",
  [
    body("musicData").isObject().withMessage("El objeto 'musicData' es requerido."),
    body("musicData.notes").isObject().withMessage("'musicData.notes' es requerido."),
    body("musicData.duration").isNumeric().withMessage("'musicData.duration' debe ser un número."),
    body("musicData.tempo").optional().isNumeric().withMessage("'musicData.tempo' debe ser un número."),
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { musicData } = req.body;
    const outputDir = path.resolve(__dirname, "..", "..", "output"); // Corregido
    const filename = `ai_generated_${Date.now()}.wav`;
    const outputPath = path.join(outputDir, filename);

    await renderAudio(musicData.notes, outputPath, musicData.duration, musicData.tempo || 120);

    res.json({ success: true, audioUrl: `/output/${filename}` }); // Estandarizado
  }),
);

// Evolucionar música con IA
router.post(
  "/evolve-with-ai",
  [
    body("notes").isObject().withMessage("El objeto 'notes' es requerido."),
    body("params").isObject().withMessage("El objeto 'params' es requerido."),
    body("apiKey").optional().isString(), // Aceptar una API Key opcional desde el cliente
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { notes, params, apiKey } = req.body;
    const aiApiKey = apiKey || config.apiKeys.chatbot; // Priorizar la clave del cliente
    if (!aiApiKey) {
      throw new Error("La clave API para la IA no está configurada en el servidor.");
    }

    const prompt = evolutionSystemPrompt(params, notes);
    const aiResponseText = await callGeminiAPI(aiApiKey, prompt);
    const jsonString = aiResponseText.replace(/```json|```/g, "").trim();
    const variations = JSON.parse(jsonString);

    res.json({ success: true, variations }); // Estandarizado
  }),
);

// Exportar a MIDI
router.post(
  "/export-midi",
  [
    body("notes").isObject().withMessage("El objeto 'notes' es requerido."),
    body("tempo").isNumeric().withMessage("El parámetro 'tempo' es requerido y debe ser un número."),
  ],
  handleValidationErrors,
  (req, res, next) => {
    const { notes, tempo } = req.body;
    try {
      const midi = new Midi();
      midi.header.setTempo(tempo);

      Object.entries(notes).forEach(([partName, noteArray]) => {
        const track = midi.addTrack();
        track.name = partName;
        noteArray.forEach((note) => {
          track.addNote({
            midi: note.pitch,
            time: note.time,
            duration: note.duration,
            velocity: note.velocity || 0.9,
          });
        });
      });

      const midiBuffer = Buffer.from(midi.toArray());
      res.set({
        "Content-Type": "audio/midi",
        "Content-Disposition": 'attachment; filename="aether-sound-creative.mid"',
      });
      res.send(midiBuffer);
    } catch (err) {
      next(err);
    }
  },
);

// Generación creativa (local)
router.post(
  "/generate-creative",
  [
    body("key").isString().notEmpty().withMessage("El parámetro 'key' es requerido."),
    body("scale").isString().notEmpty().withMessage("El parámetro 'scale' es requerido."),
    body("tempo").isNumeric().withMessage("El parámetro 'tempo' debe ser un número."),
    body("drumPattern").optional().isString(),
  ],
  handleValidationErrors,
  (req, res, next) => {
    try {
      const params = req.body;
      logger.info(
        `Petición para generar notas: ${params.key} ${params.scale} @ ${params.tempo} BPM`,
      );
      // Generar audio y devolver la URL del WAV
      const outDir = path.resolve(__dirname, "..", "..", "output");
      Promise.resolve(generateCreativeMusic({ outputDir: outDir, ...params }))
        .then((musicData) => {
          // Si el generador devuelve filePath lo usamos; devolvemos notas y duración cuando esté disponible
          const filePath = musicData?.filePath || musicData?.file || null;
          const notes = musicData?.notes || [];
          const duration = musicData?.duration || null;
          if (filePath) {
            res.json({ success: true, audioUrl: `/output/${path.basename(filePath)}`, notes, duration, params });
          } else {
            res.json({ success: true, notes, duration, params });
          }
        })
        .catch(next);
    } catch (err) {
      next(err);
    }
  },
);

// Generar una composición desde el generador de composición
router.post(
  "/generate/composition",
  [body("durationSec").optional().isNumeric(), body("bpm").optional().isNumeric()],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const outDir = path.resolve(__dirname, "..", "..", "output");
    const { durationSec, bpm, key, scale } = req.body;
    const fp = await generateComposition({ outputDir: outDir, bpm: Number(bpm) || 100, key: key || 'C', scale: scale || 'major', durationSec: Number(durationSec) });
    res.json({ success: true, audioUrl: `/output/${path.basename(fp)}` });
  }),
);

// Generar composición y empacar MP3/otros en ZIP para descargar
router.post(
  "/generate/zip-composition",
  [body('durationSec').optional().isNumeric(), body('bpm').optional().isNumeric(), body('format').optional().isString()],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const outDir = path.resolve(__dirname, "..", "..", "output");
    const { durationSec, bpm, format } = req.body;

    // 1) generar wav usando generateComposition
    const wavPath = await generateComposition({ outputDir: outDir, bpm: Number(bpm) || 100, durationSec: Number(durationSec) || 8 });

    // 2) convertir a mp3 si se pide mp3
    const chosenFormat = (format || 'mp3').toLowerCase();
    const filesToZip = [];
    if (chosenFormat === 'mp3' || chosenFormat === 'both' || chosenFormat === 'mp4') {
      try {
        if (ffmpeg.isFfmpegAvailable()) {
          if (chosenFormat === 'mp4') {
            const mp4Path = wavPath.replace(/\.wav$/i, '.mp4');
            ffmpeg.convertWavToMp4(wavPath, mp4Path);
            filesToZip.push({ path: mp4Path, name: path.basename(mp4Path) });
          } else {
            const mp3Path = wavPath.replace(/\.wav$/i, '.mp3');
            ffmpeg.convertWavToMp3(wavPath, mp3Path);
            filesToZip.push({ path: mp3Path, name: path.basename(mp3Path) });
          }
        } else {
          // fallback to lamejs encoder if available
          if (chosenFormat === 'mp4') {
            logger.warn('ffmpeg no disponible; no se puede crear MP4. Se incluirá WAV/MP3 si es posible.');
          }
          const { readWav } = require('../utils/audio-renderer');
          const wavData = readWav(wavPath);
          const mp3Path = wavPath.replace(/\.wav$/i, '.mp3');
          encodeMp3(wavData.samples, wavData.sampleRate, mp3Path);
          filesToZip.push({ path: mp3Path, name: path.basename(mp3Path) });
        }
      } catch (e) {
        logger.warn(`No se pudo convertir el audio: ${e.message}. Se incluirá solo WAV.`);
      }
    }

    if (chosenFormat === 'wav' || chosenFormat === 'both') {
      filesToZip.push({ path: wavPath, name: path.basename(wavPath) });
    }

    // 3) crear zip
    const zipName = `composition_${Date.now()}.zip`;
    const zipPath = path.join(outDir, zipName);
    await new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));
      archive.pipe(output);
      for (const f of filesToZip) archive.file(f.path, { name: f.name });
      archive.finalize();
    });

    res.json({ success: true, downloadUrl: `/output/${zipName}` });
  }),
);

// Generar simple synth
router.post(
  "/generate/simple-synth",
  [body("durationSec").optional().isNumeric()],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const outDir = path.resolve(__dirname, "..", "..", "output");
    const { durationSec } = req.body;
    const fp = await generateSynth({ outputDir: outDir, durationSec: Number(durationSec) || 5 });
    res.json({ success: true, audioUrl: `/output/${path.basename(fp)}` });
  }),
);

// Generar melodía aleatoria y devolver URL del WAV
router.post(
  "/generate/random-melody",
  [body("lengthSec").optional().isNumeric()],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const outDir = path.resolve(__dirname, "..", "..", "output");
    const { lengthSec } = req.body;
    const fp = await generateRandomMelody({ outputDir: outDir, lengthSec: Number(lengthSec) || 6 });
    res.json({ success: true, audioUrl: `/output/${path.basename(fp)}` });
  }),
);

// --- NUEVO: RUTA PARA CREAR MANIFIESTO DE ÁLBUM ---
router.post(
  "/album/create",
  [
    body("title").notEmpty().withMessage("El título del álbum es requerido."),
    body("artist").notEmpty().withMessage("El artista del álbum es requerido."),
    body("cover").optional().isURL().withMessage("La portada debe ser una URL válida."),
    body("tracks").isArray({ min: 1 }).withMessage("Se requiere al menos una pista para el álbum."),
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { title, artist, description, cover, tracks } = req.body;

    // Crear un ID único para el álbum basado en el título y la fecha
    const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const albumId = `${slugify(artist)}-${slugify(title)}-${Date.now()}`;

    const manifest = {
      albumId,
      title,
      artist,
      description: description || "",
      cover: cover || "",
      tracks, // Array de nombres de archivo .wav
      createdAt: new Date().toISOString(),
    };

    const manifestPath = path.resolve(__dirname, "..", "..", "output", `${albumId}.json`); // Corregido
    await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    logger.info(`Manifiesto de álbum creado: ${albumId}`);
    res.status(201).json({ success: true, message: "Manifiesto de álbum creado.", albumId });
  }),
);

router.post(
  "/transcribe-melody",
  upload.single("audio_melody"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No se ha subido ningún archivo de audio." });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    try {
      const transcriptionResult = await transcribeAudioWithGemini(filePath, mimeType);
      res.json({ success: true, notes: transcriptionResult });
    } finally {
      // Limpiar el archivo temporal
      await fsp.unlink(filePath).catch(e => logger.warn(`No se pudo limpiar el archivo temporal: ${e.message}`));
    }
  }),
);

module.exports = router;