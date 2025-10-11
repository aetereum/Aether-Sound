const http = require('node:http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    message: 'Server is running',
    time: new Date().toISOString()
  }));
});

const port = 4000;
server.listen(port, '127.0.0.1', () => {
  console.log(`Test server running at http://127.0.0.1:${port}`);
});
