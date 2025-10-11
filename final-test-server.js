const http = require('node:http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Aether-Sound server working!\n');
});

const PORT = 80;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`
===========================================
    Servidor de prueba final
===========================================
► Servidor escuchando en:
  http://127.0.0.1
  
► Prueba en el navegador:
  http://127.0.0.1
===========================================
`);
});
