require("dotenv").config();
const logger = require("../utils/logger");

const config = {
  env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 3000,
  apiKeys: {
    chatbot: process.env.AETHER_CHATBOT_API_KEY,
    internal: process.env.AETHER_SOUND_API_KEY,
  },
  acrCloud: {
    host: process.env.ACR_HOST,
    accessKey: process.env.ACR_ACCESS_KEY,
    accessSecret: process.env.ACR_ACCESS_SECRET,
  },
  hedera: {
    network: process.env.HEDERA_NETWORK || "testnet",
    accountId: process.env.HEDERA_ACCOUNT_ID,
    privateKey: process.env.HEDERA_PRIVATE_KEY,
  },
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    // La URL a la que Google redirigirá tras la autenticación.
    redirectUri: "http://localhost:3000/api/distribution/youtube/callback",
  },
};

// --- Validación de Configuración Esencial ---
// Usamos el logger para mantener la consistencia en los mensajes.

if (!config.apiKeys.chatbot) {
  logger.warn("No se detectó AETHER_CHATBOT_API_KEY. Las funcionalidades de IA como Chatbot y Evolve no estarán disponibles.");
}

if (!config.acrCloud.host || !config.acrCloud.accessKey || !config.acrCloud.accessSecret) {
  logger.warn(
    "Las credenciales de ACRCloud no están completamente configuradas. La identificación de canciones no funcionará.",
  );
}

if (!config.hedera.accountId || !config.hedera.privateKey) {
  logger.warn(
    "No se detectó HEDERA_ACCOUNT_ID o HEDERA_PRIVATE_KEY. La funcionalidad de Hedera no estará disponible.",
  );
}

if (!config.youtube.clientId || !config.youtube.clientSecret) {
  logger.warn(
    "No se detectó YOUTUBE_CLIENT_ID o YOUTUBE_CLIENT_SECRET. La publicación en YouTube no estará disponible.",
  );
}

module.exports = config;