const express = require("express");
const multer = require("multer");
const path = require("node:path");
const fsp = require("node:fs/promises");
const logger = require("../utils/logger");
const { separateAudio, convertVoiceStyle } = require("../services/ai-music-services");

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, "..", "..", "uploads") });

// Wrapper para rutas asíncronas
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Ruta para separar las vocales de una canción.
 */
router.post("/separate-vocals", upload.single("source_audio"), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No se ha subido ningún archivo de audio." });
  }

  const outputDir = path.join(__dirname, "..", "..", "output");
  try {
    const { vocalsPath, instrumentalPath } = await separateAudio(req.file.path, outputDir);
    res.json({
      success: true,
      vocalsUrl: `/output/${path.basename(vocalsPath)}`,
      instrumentalUrl: `/output/${path.basename(instrumentalPath)}`,
    });
  } finally {
    await fsp.unlink(req.file.path).catch(e => logger.warn(`No se pudo limpiar el archivo temporal: ${e.message}`));
  }
}));

/**
 * Ruta para convertir el estilo de una voz.
 */
router.post("/convert-voice", upload.fields([
  { name: 'source_voice', maxCount: 1 },
  { name: 'reference_voice', maxCount: 1 }
]), asyncHandler(async (req, res) => {
  if (!req.files || !req.files.source_voice || !req.files.reference_voice) {
    return res.status(400).json({ success: false, message: "Se requieren ambos archivos de voz (origen y referencia)." });
  }

  const sourceVoiceFile = req.files.source_voice[0];
  const referenceVoiceFile = req.files.reference_voice[0];
  const outputDir = path.join(__dirname, "..", "..", "output");

  try {
    const { convertedVoicePath } = await convertVoiceStyle(sourceVoiceFile.path, referenceVoiceFile.path, outputDir);
    res.json({
      success: true,
      convertedVoiceUrl: `/output/${path.basename(convertedVoicePath)}`,
    });
  } finally {
    await fsp.unlink(sourceVoiceFile.path).catch(e => logger.warn(`Error al limpiar archivo: ${e.message}`));
    await fsp.unlink(referenceVoiceFile.path).catch(e => logger.warn(`Error al limpiar archivo: ${e.message}`));
  }
}));

module.exports = router;