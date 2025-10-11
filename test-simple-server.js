const http = require('node:http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Test server working\n');
});

server.listen(3002, '0.0.0.0', () => {
  console.log('Test server running at http://localhost:3002/');
});
