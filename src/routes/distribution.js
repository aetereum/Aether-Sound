const express = require("express");
const config = require("../config");
const logger = require("../utils/logger");

const router = express.Router();

// --- Configuración de OAuth 2.0 para Google (opcional) ---
// La dependencia `googleapis` es opcional en tiempo de ejecución. Si no está
// instalada o faltan credenciales, las rutas de YouTube devolverán una
// respuesta informativa en vez de romper el arranque del servidor.
let googlePkg = null;
let oauth2Client = null;
try {
  // Cargar sólo si está disponible
  googlePkg = require('googleapis');
} catch (err) {
  logger.warn('Paquete optional `googleapis` no encontrado. Rutas de YouTube deshabilitadas. ' + err.message);
}

if (googlePkg && config && config.youtube && config.youtube.clientId && config.youtube.clientSecret && config.youtube.redirectUri) {
  try {
    oauth2Client = new googlePkg.google.auth.OAuth2(
      config.youtube.clientId,
      config.youtube.clientSecret,
      config.youtube.redirectUri
    );
  } catch (e) {
    oauth2Client = null;
    logger.warn('No se pudo crear oauth2Client para YouTube: ' + e.message);
  }
} else if (googlePkg) {
  logger.warn('Faltan credenciales de YouTube en config; las rutas de publicación estarán deshabilitadas.');
}

/**
 * Inicia el flujo de autenticación de OAuth2 con Google.
 * Redirige al usuario a la pantalla de consentimiento de Google.
 */
router.get("/youtube/auth", (req, res) => {
  if (!oauth2Client) {
    logger.warn('Solicitud a /api/distribution/youtube/auth pero OAuth2 no está disponible.');
    return res.status(503).send('YouTube OAuth no está disponible: dependencia `googleapis` faltante o credenciales no configuradas.');
  }

  const scopes = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
  });

  logger.info("Redirigiendo a Google para autenticación de YouTube...");
  res.redirect(url);
});

/**
 * Callback de OAuth2 para YouTube. Si OAuth2 no está disponible, respondemos con 503.
 */
router.get("/youtube/callback", (req, res) => {
  if (!oauth2Client) {
    return res.status(503).send('YouTube OAuth no está disponible: dependencia `googleapis` faltante o credenciales no configuradas.');
  }
  const { code } = req.query;
  // Aquí, intercambiarías el 'code' por tokens de acceso y los guardarías de forma segura.
  res.send(`¡Autenticación exitosa! Código recibido: ${code}. Implementación pendiente.`);
});

module.exports = router;