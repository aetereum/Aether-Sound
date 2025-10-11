const express = require('express');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs').promises;

// Crear aplicación Express
const app = express();

// Configuración básica
app.use(express.json());
app.use(express.static('public'));

// Ruta principal
app.get('/', (req, res) => {
  res.send('Aether-Sound API Running');
});

// Crear servidor HTTP
const server = http.createServer(app);

// Función para encontrar puerto disponible
async function findAvailablePort(startPort) {
  const net = require('node:net');
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, '127.0.0.1');

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

// Iniciar servidor
async function startServer() {
  try {
    const port = await findAvailablePort(3000);

    server.listen(port, '127.0.0.1', () => {
      console.log(`
=========================================
    Aether-Sound Server
=========================================
Server running at:
http://127.0.0.1:${port}

Press Ctrl+C to stop
=========================================
`);
    });

    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Iniciar el servidor
startServer();
