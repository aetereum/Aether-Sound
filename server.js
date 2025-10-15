const express = require("express");
const path = require("node:path");
const { Client } = require("@hashgraph/sdk");

const config = require("./src/config");
const logger = require("./src/utils/logger");
const apiRouter = require("./src/routes/api");
const hederaRouter = require("./src/routes/hedera.js"); // Ruta corregida
const distributionRouter = require("./src/routes/distribution.js");
const remixRouter = require("./src/routes/remix.js");

const app = express();

// --- Configuración de Multer para subida de archivos ---
const uploadDir = path.join(__dirname, "uploads");

// Middlewares de seguridad
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

// Configurar límites de peticiones
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 peticiones por ventana
});

// Middlewares
app.use(helmet()); // Seguridad básica
app.use(cors()); // Permitir CORS
app.use(limiter); // Rate limiting
app.use(express.json()); // Para parsear JSON en el body de las peticiones
app.use(express.static(path.join(__dirname, "public"))); // Servir archivos estáticos desde /public
app.use("/output", express.static(path.join(__dirname, "output"))); // Servir archivos generados
// app.use('/api/mastering', masteringEngineRouter);

// Endpoint de prueba
app.get("/test", (req, res) => {
  res.json({ success: true, message: "Aether-Sound API está funcionando" });
});

// --- LÓGICA DE HEDERA ---
const outputDir = path.join(__dirname, "output");

function getClient() {
  // Comprobamos si las credenciales existen. Si no, devolvemos null.
  if (!config.hedera.accountId || !config.hedera.privateKey) {
    logger.warn("Credenciales de Hedera no configuradas. Las rutas de Hedera no funcionarán.");
    return null;
  }
  // Si existen, configuramos el cliente.
  const client = Client.forName(config.hedera.network);
  client.setOperator(config.hedera.accountId, config.hedera.privateKey);
  return client;
}

// Montar el router de Hedera
// Lo pasamos como una función que recibe las dependencias que necesita
app.use("/api/hedera", hederaRouter(outputDir, getClient));

// Montar el router de Distribución (YouTube, etc.)
app.use("/api/distribution", distributionRouter);

// Montar el router de Remix IA
app.use("/api/remix", remixRouter);


// --- RUTAS PRINCIPALES ---

// Usar el router de la API
app.use("/api", apiRouter);

// --- MANEJADOR DE ERRORES CENTRALIZADO ---
// Debe ser el último middleware que se añade.
app.use((err, req, res, _next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  if (config.env === "development") {
    logger.error(err.stack);
  }

  // Evitar enviar detalles del error en producción por seguridad
  const errorMessage = config.env === 'production' 
    ? 'Ocurrió un error en el servidor.' 
    : err.message;

  res.status(err.status || 500).json({ success: false, message: errorMessage });
});

// Función para verificar el puerto
const checkPort = (port) =>
  new Promise((resolve, reject) => {    
    const numericPort = parseInt(port, 10);
    const test = require("node:net")
      .createServer()
      .once("error", (err) => {
            if (err.code === "EADDRINUSE") {
              logger.warn(`Puerto ${numericPort} está en uso, intentando ${numericPort + 1}`);
              resolve(checkPort(numericPort + 1));
            } else {
              reject(err);
            }
          })
      .once("listening", () => {
        test.once("close", () => resolve(port)).close();
      })
      .listen(numericPort);
  });

const startServer = async (initialPort) => {
  // Función para asegurar que los directorios existen
  const fsp = require("node:fs").promises;
  const ensureDir = async (dirPath) => {
    await fsp.mkdir(dirPath, { recursive: true });
  };

  try {
    logger.info("Creando directorios necesarios...");
    await ensureDir(uploadDir);
    await ensureDir(path.join(__dirname, "output"));
    await ensureDir(path.join(__dirname, "logs"));
    logger.info("Directorios creados correctamente.");

    const availablePort = await checkPort(initialPort);

    const server = app.listen(availablePort, () => {
      logger.info(`🚀 Aether-Sound escuchando en http://localhost:${availablePort}`);
      logger.info("Directorios de trabajo:");
      logger.info(`- Uploads: ${uploadDir}`);
      logger.info(`- Output:  ${path.join(__dirname, "output")}`);
      logger.info(`- Logs:    ${path.join(__dirname, "logs")}`);
    });
    // `server` se usa implícitamente; evitar warning de linter sobre variable no usada
    void server;

  } catch (err) {
    logger.error(`Error fatal al iniciar el servidor: ${err.message}`);
    process.exit(1);
  }
};

startServer(config.port);
