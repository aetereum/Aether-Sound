const winston = require("winston");
const path = require("node:path");

const { combine, timestamp, printf, colorize, align } = winston.format;

// Formato personalizado para los logs
const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    align(),
    logFormat,
  ),
  transports: [
    // Guardar todos los logs de nivel 'info' y superior en `combined.log`
    new winston.transports.File({
      filename: path.join(__dirname, "..", "..", "logs", "combined.log"),
    }),
    // Guardar todos los logs de nivel 'error' y superior en `error.log`
    new winston.transports.File({
      filename: path.join(__dirname, "..", "..", "logs", "error.log"),
      level: "error",
    }),
  ],
});

// Si no estamos en producción, también mostrar logs en la consola con colores
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({ format: combine(colorize(), logFormat) }),
  );
}

module.exports = logger;