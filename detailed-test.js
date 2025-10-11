const http = require('node:http');

console.log('Iniciando prueba de conexión HTTP...\n');

// Opciones para la petición HTTP
const options = {
  hostname: '127.0.0.1',
  port: 9999,
  path: '/',
  method: 'GET',
  timeout: 5000, // 5 segundos de timeout
  headers: {
    'User-Agent': 'Node.js Test Client',
    'Accept': '*/*'
  }
};

console.log(`Intentando conectar a http://${options.hostname}:${options.port}${options.path}`);

// Realizar petición HTTP
const req = http.request(options, (res) => {
  console.log('\nRespuesta recibida:');
  console.log(`Estado: ${res.statusCode} ${res.statusMessage}`);
  console.log('Headers:', res.headers);

  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('\nCuerpo de la respuesta:', data);
    process.exit(0);
  });
});

// Manejar errores
req.on('error', (error) => {
  console.error('\nError de conexión:');
  console.error(`Tipo: ${error.name}`);
  console.error(`Mensaje: ${error.message}`);
  console.error(`Código: ${error.code}`);

  if (error.code === 'ECONNREFUSED') {
    console.error('\nPosibles causas:');
    console.error('1. El servidor no está ejecutándose');
    console.error('2. El puerto está bloqueado');
    console.error('3. Firewall está bloqueando la conexión');
  }

  process.exit(1);
});

// Manejar timeout
req.on('timeout', () => {
  console.error('\nTimeout: La conexión tardó demasiado');
  req.destroy();
  process.exit(1);
});

// Enviar la petición
req.end();
