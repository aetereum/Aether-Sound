const http = require('node:http');

// Crear un servidor HTTP simple
const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // Respuesta básica
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Aether-Sound server is running');
});

// Puerto y host
const PORT = 8000;
const HOST = '127.0.0.1';

// Iniciar servidor
server.listen(PORT, HOST, () => {
  console.log(`
========================================
    Test Server
========================================
Server running at:
http://${HOST}:${PORT}

Press Ctrl+C to stop
========================================
`);
});
