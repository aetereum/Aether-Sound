const http = require('node:http');

console.log('Iniciando prueba del servidor (tests/test-server-fixed.js)...');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/test',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, res => {
  console.log(`Status Code: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Respuesta recibida:');
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch (err) {
      console.log(data);
    }
    process.exit(0);
  });
});

req.on('error', err => {
  console.error('Error al conectar:', err.message || err); process.exit(1);
});
req.on('timeout', () => {
  console.error('Timeout'); req.destroy(); process.exit(1);
});
req.end();
