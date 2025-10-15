const express = require('express');
const app = express();
// path not used in this helper
// const path = require('node:path');

// Configuración mínima
app.use(express.static('public'));

// Página de inicio simple
app.get('/', (req, res) => {
  res.send(`
        <html>
            <head>
                <title>Aether-Sound Test</title>
            </head>
            <body>
                <h1>Aether-Sound Test Page</h1>
                <p>Server is working!</p>
            </body>
        </html>
    `);
});

// Intenta varios puertos comunes
const ports = [80, 8080, 3000, 8000];
let currentPortIndex = 0;

function tryPort() {
  const port = ports[currentPortIndex];
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`
==========================================
    Aether-Sound Test Server
==========================================
Server running at:
http://localhost:${port}
http://127.0.0.1:${port}

Try opening in your browser:
http://localhost:${port}

Press Ctrl+C to stop
==========================================
        `);
  }).on('error', (_err) => {
    if (_err.code === 'EADDRINUSE' && currentPortIndex < ports.length - 1) {
      console.log(`Port ${port} in use, trying next port...`);
      currentPortIndex++;
      tryPort();
    } else {
      console.error('Server error:', _err);
      // ensure we reference server variable to avoid unused-var in some lint configs
      void server.address();
      process.exit(1);
    }
  });
}

// Iniciar servidor
tryPort();
