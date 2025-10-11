const http = require('node:http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Server is working!\n');
});

const PORT = 8080; // Usando un puerto más alto
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
===========================================
    Servidor de prueba Aether-Sound
===========================================
► Escuchando en:
  - http://localhost:${PORT}
  - http://127.0.0.1:${PORT}
  
► Para probar, abre tu navegador en:
  http://localhost:${PORT}
  
► O usa el comando:
  Invoke-WebRequest http://localhost:${PORT}
  
► Presiona Ctrl+C para detener el servidor
===========================================
`);
});
