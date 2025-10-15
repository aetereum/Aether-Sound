const http = require('node:http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

server.listen(80, '0.0.0.0', () => {
  console.log('Servidor corriendo en http://localhost');
});
const http = require('node:http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

server.listen(80, '0.0.0.0', () => {
  console.log('Servidor corriendo en http://localhost');
});
