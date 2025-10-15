const http = require('node:http');

// Crear servidor HTTP básico
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Servidor funcionando\n');
});

// Encontrar un puerto disponible (archivo archivado)
// ...

// Iniciar servidor (archivo archivado)
// ...
