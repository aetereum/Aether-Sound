const http = require('node:http');

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify({
    status: 'ok',
    message: 'Server is running',
    time: new Date().toISOString()
  }));
});

const port = 5500;
server.listen(port, '0.0.0.0', () => {
  console.log('='.repeat(40));
  console.log('Test Server Status');
  console.log('='.repeat(40));
  console.log(`✓ Server running on port ${port}`);
  console.log('✓ Try accessing:');
  console.log(`  - http://localhost:${port}`);
  console.log(`  - http://127.0.0.1:${port}`);
  console.log(`  - http://0.0.0.0:${port}`);
  console.log('='.repeat(40));
});
