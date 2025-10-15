const http = require('node:http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Server is working!\n');
});

const PORT = 8080; // Usando un puerto más alto
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n===========================================\n    Servidor de prueba Aether-Sound\n===========================================\n► Escuchando en:\n  - http://localhost:${PORT}\n  - http://127.0.0.1:${PORT}\n  \n► Para probar, abre tu navegador en:\n  http://localhost:${PORT}\n  \n► O usa el comando:\n  Invoke-WebRequest http://localhost:${PORT}\n  \n► Presiona Ctrl+C para detener el servidor\n===========================================\n`);
});
