const fetch = require("node-fetch");
const crypto = require("node:crypto");
// fs and path were previously imported but are not used in this module.
// Keep imports out to satisfy the linter and avoid unused-vars warnings.
const FormData = require("form-data");
const logger = require("./src/utils/logger");
const config = require("./src/config");

/**
 * Llama a la API de Gemini para tareas de generación de texto o JSON.
 * @param {String} apiKey La clave de API para autenticar.
 * @param {String} prompt El prompt completo para la IA.
 * @returns {Promise<string>} La respuesta de texto de la IA.
 */
async function callGeminiAPI(apiKey, prompt) {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

/**
 * Llama a la API de ACRCloud para identificar una canción desde un archivo de audio.
 * @param {Buffer} audioBuffer - El buffer del archivo de audio a identificar.
 * @returns {Promise<object>} - Los metadatos de la canción identificada.
 */
async function identifySongWithACRCloud(audioBuffer) {
  const { host, accessKey, accessSecret } = config.acrCloud;

  if (!host || !accessKey || !accessSecret) {
    throw new Error("Las credenciales de ACRCloud no están configuradas en el archivo .env");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = `POST\n/v1/identify\n${accessKey}\naudio\n1\n${timestamp}`;

  const signature = crypto.createHmac("sha1", accessSecret).update(stringToSign).digest("base64");

  const formData = new FormData();
  formData.append("sample", audioBuffer, { filename: "sample.wav" });
  formData.append("access_key", accessKey);
  formData.append("data_type", "audio");
  formData.append("signature_version", "1");
  formData.append("signature", signature);
  formData.append("sample_bytes", audioBuffer.length);
  formData.append("timestamp", timestamp);

  const response = await fetch(`https://${host}/v1/identify`, {
    method: "POST",
    body: formData,
    headers: formData.getHeaders(),
  });

  const result = await response.json();

  if (result.status.code !== 0) {
    if (result.status.code === 1001) return { success: false, message: "No se encontró ninguna coincidencia." };
    throw new Error(`Error de ACRCloud: ${result.status.msg} (código: ${result.status.code})`);
  }

  return { success: true, data: result.metadata.music[0] };
}

/**
 * Transcribe una melodía de un archivo de audio a formato de notas usando Gemini.
 * @param {string} filePath Ruta al archivo de audio.
 * @param {string} mimeType Mime-type del archivo (ej. 'audio/webm').
 * @returns {Promise<object>} Un objeto con las notas de la melodía.
 */
async function transcribeAudioWithGemini(_filePath, _mimeType) {
  // Implementación pendiente. Esto requeriría una lógica más compleja
  // para interactuar con la API de Gemini para transcripción de audio.
  logger.warn("La función transcribeAudioWithGemini aún no está implementada.");
  return { notes: [] }; // Devuelve un resultado placeholder.
}

module.exports = { callGeminiAPI, identifySongWithACRCloud, transcribeAudioWithGemini };