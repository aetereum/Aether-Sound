require('dotenv').config();
const express = require('express');
const path = require('node:path');
const fs = require('node:fs').promises;
const multer = require('multer');
const cors = require('cors');

// Importar generadores
const { generateComposition } = require('./src/generators/composition-generator');
const { generateDrums } = require('./src/generators/drum-generator');
const { generateSynth } = require('./src/generators/render-simple-synth');

// Configuración de Express
const app = express();
const PORT = process.env.PORT || 8080;

// Configuración de multer
const uploadDir = path.join(__dirname, 'uploads');
const upload = multer({ dest: uploadDir });
// kept for runtime use - referenced here to avoid linter complaining about unused var
void upload;

// Middleware básico
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.static('public'));
app.use('/output', express.static('output'));
app.use('/uploads', express.static('uploads'));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint para generar batería
app.post('/generate-drums', async (req, res) => {
  try {
    console.log('Generando ritmo de batería...');
    const outputPath = await generateDrums({
      outputDir: path.join(__dirname, 'output')
    });
    res.json({
      success: true,
      file: `/output/${path.basename(outputPath)}`
    });
  } catch (err) {
    console.error('Error generando drums:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para generar composición
app.post('/generate-composition', async (req, res) => {
  try {
    console.log('Generando composición musical...');
    const outputPath = await generateComposition({
      outputDir: path.join(__dirname, 'output')
    });
    res.json({
      success: true,
      file: `/output/${path.basename(outputPath)}`
    });
  } catch (err) {
    console.error('Error generando composición:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para generar sintetizador
app.post('/generate-synth', async (req, res) => {
  try {
    console.log('Generando sonido de sintetizador...');
    const outputPath = await generateSynth({
      outputDir: path.join(__dirname, 'output')
    });
    res.json({
      success: true,
      file: `/output/${path.basename(outputPath)}`
    });
  } catch (err) {
    console.error('Error generando synth:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Función para encontrar puerto disponible
async function findAvailablePort(startPort) {
  const net = require('node:net');
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, '0.0.0.0');

    server.on('listening', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

// Función para verificar directorios
async function ensureDirectories() {
  const dirs = ['public', 'output', 'uploads'];
  for (const dir of dirs) {
    await fs.mkdir(path.join(__dirname, dir), { recursive: true });
  }
}

// Función principal para iniciar el servidor
async function startServer() {
  try {
    // Verificar directorios
    await ensureDirectories();
    console.log('✓ Directorios verificados');

    // Encontrar puerto disponible
    const port = await findAvailablePort(PORT);
    console.log(`✓ Puerto ${port} disponible`);

    // Iniciar servidor
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`
==========================================
    Aether-Sound API
==========================================
✓ Servidor iniciado exitosamente
✓ Puerto: ${port}
✓ URL: http://localhost:${port}

Endpoints disponibles:
- GET  /                 → Página principal
- POST /generate-drums   → Generar ritmos
- POST /generate-composition → Generar composición
- POST /generate-synth   → Generar sintetizador

Presiona Ctrl+C para detener el servidor
==========================================
`);
    });

    // Manejador de errores del servidor
    server.on('error', (error) => {
      console.error('Error en el servidor:', error);
      process.exit(1);
    });

    // Manejadores de proceso
    process.on('SIGTERM', () => {
      console.log('Recibida señal SIGTERM, cerrando servidor...');
      server.close(() => process.exit(0));
    });

    process.on('SIGINT', () => {
      console.log('Recibida señal SIGINT, cerrando servidor...');
      server.close(() => process.exit(0));
    });

  } catch (err) {
    console.error('Error fatal:', err);
    process.exit(1);
  }
}

// Iniciar el servidor
startServer();
