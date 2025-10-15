const express = require('express');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const cors = require('cors');
const { generateComposition } = require('./src/generators/composition-generator');
const { generateDrums } = require('./src/generators/drum-generator');
const { generateSynth } = require('./src/generators/render-simple-synth');

// Configuración básica
const app = express();
const server = http.createServer(app);

// Middleware esencial
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/output', express.static('output'));

// Rutas API
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Endpoint para generar ritmos
app.post('/api/generate/drums', async (req, res) => {
  try {
    console.log('Generando ritmo...');
    const outputPath = await generateDrums({
      outputDir: path.join(__dirname, 'output')
    });
    res.json({
      success: true,
      file: `/output/${path.basename(outputPath)}`
    });
  } catch (err) {
    console.error('Error en generación de ritmo:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para generar composición
app.post('/api/generate/composition', async (req, res) => {
  try {
    console.log('Generando composición...');
    const outputPath = await generateComposition({
      outputDir: path.join(__dirname, 'output')
    });
    res.json({
      success: true,
      file: `/output/${path.basename(outputPath)}`
    });
  } catch (err) {
    console.error('Error en generación de composición:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para generar sintetizador
app.post('/api/generate/synth', async (req, res) => {
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
    console.error('Error en generación de sintetizador:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Función para verificar directorios
async function ensureDirectories() {
  const dirs = ['public', 'output', 'uploads'];
  for (const dir of dirs) {
    await fs.promises.mkdir(path.join(__dirname, dir), { recursive: true });
  }
}

// Función para encontrar puerto disponible
async function findAvailablePort(startPort) {
  const net = require('node:net');
  let port = startPort;

  while (port < startPort + 10) {
    try {
      await new Promise((resolve) => {
        const tester = net.createServer()
          .once('error', () => {
            port++;
            resolve(false);
          })
          .once('listening', () => {
            tester.once('close', () => resolve(true)).close();
          })
          .listen(port);
      });
      return port;
    } catch {
      port++;
    }
  }
  throw new Error('No se encontró puerto disponible');
}

// Función principal para iniciar el servidor
async function startServer() {
  try {
    // Verificar directorios
    await ensureDirectories();
    console.log('✓ Directorios verificados');

    // Encontrar puerto disponible
    const port = await findAvailablePort(8080);
    console.log(`✓ Puerto ${port} disponible`);

    // Crear archivo de página principal
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (!fs.existsSync(indexPath)) {
      await fs.promises.writeFile(indexPath, `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aether-Sound</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        button { 
            padding: 10px 20px; 
            margin: 5px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover { background: #45a049; }
        #output { margin-top: 20px; }
        audio { width: 100%; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Aether-Sound</h1>
        <div>
            <button onclick="generate('drums')">Generar Ritmo</button>
            <button onclick="generate('composition')">Generar Composición</button>
            <button onclick="generate('synth')">Generar Sintetizador</button>
        </div>
        <div id="output"></div>
    </div>
    <script>
        async function generate(type) {
            const output = document.getElementById('output');
            output.innerHTML = 'Generando...';
            try {
                const response = await fetch(\`/api/generate/\${type}\`, {
                    method: 'POST'
                });
                const data = await response.json();
                if (data.success) {
                    output.innerHTML = \`
                        <h3>Generación exitosa</h3>
                        <audio controls src="\${data.file}"></audio>
                    \`;
                } else {
                    output.innerHTML = \`<p style="color: red">Error: \${data.error}</p>\`;
                }
            } catch (error) {
                output.innerHTML = \`<p style="color: red">Error: \${error.message}</p>\`;
            }
        }
    </script>
</body>
</html>
            `);
    }

    // Iniciar servidor
    return new Promise((resolve, _reject) => {
      server.listen(port, '127.0.0.1', () => {
        console.log(`
==========================================
    Aether-Sound API
==========================================
✓ Servidor iniciado exitosamente
✓ Puerto: ${port}
✓ URL: http://127.0.0.1:${port}

Endpoints disponibles:
- GET  /                    → Interfaz web
- GET  /api/health         → Estado del servidor
- POST /api/generate/drums → Generar ritmos
- POST /api/generate/composition → Generar composición
- POST /api/generate/synth → Generar sintetizador

Directorios:
- /public → Archivos estáticos
- /output → Archivos generados

Presiona Ctrl+C para detener
==========================================
                `);
        resolve();
      });

      server.on('error', (error) => {
        console.error('Error en el servidor:', error);
        _reject(error);
      });
    });

  } catch (err) {
    console.error('Error fatal:', err);
    process.exit(1);
  }
}

// Manejo de señales
process.on('SIGTERM', () => {
  console.log('\nCerrando servidor...');
  server.close(() => {
    console.log('Servidor detenido correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nCerrando servidor...');
  server.close(() => {
    console.log('Servidor detenido correctamente');
    process.exit(0);
  });
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
  server.close(() => process.exit(1));
});

// Iniciar el servidor
startServer();
