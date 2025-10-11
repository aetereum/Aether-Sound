const http = require('node:http');

console.log('Testing server connection...');

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:', data);
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error('Error details:', error);
  process.exit(1);
});

req.setTimeout(5000, () => {
  console.error('Request timed out');
  process.exit(1);
});

req.end();
