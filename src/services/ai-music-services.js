const logger = require("../utils/logger");

/**
 * Separa las vocales de una canción del instrumental.
 * @param {string} sourcePath Ruta al archivo de audio original.
 * @param {string} outputDir Directorio de salida para los archivos separados.
 * @returns {Promise<object>} Un objeto con las rutas de los archivos separados.
 */
async function separateAudio(_sourcePath, _outputDir) {
  logger.warn("La función separateAudio aún no está implementada.");
  // Implementación futura: usar Spleeter, Demucs u otra herramienta de separación de audio
  throw new Error("La separación de audio no está implementada aún.");
}

/**
 * Convierte el estilo de una voz usando una voz de referencia.
 * @param {string} sourceVoicePath Ruta al archivo de voz de origen.
 * @param {string} referenceVoicePath Ruta al archivo de voz de referencia.
 * @param {string} outputDir Directorio de salida.
 * @returns {Promise<object>} Un objeto con la ruta del archivo convertido.
 */
async function convertVoiceStyle(_sourceVoicePath, _referenceVoicePath, _outputDir) {
  logger.warn("La función convertVoiceStyle aún no está implementada.");
  // Implementación futura: usar RVC, So-VITS-SVC u otra herramienta de conversión de voz
  throw new Error("La conversión de voz no está implementada aún.");
}

module.exports = {
  separateAudio,
  convertVoiceStyle,
};
