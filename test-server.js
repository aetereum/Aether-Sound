const http = require('http');

console.log('Iniciando prueba del servidor...');

// Simple health check
const http = require('http');

console.log('Iniciando prueba del servidor...');

// Simple health check
const options = {
  const http = require('http');

  console.log('Iniciando prueba del servidor...');

  // Simple health check
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/test',
    method: 'GET',
    timeout: 5000 // 5 segundos de timeout
  };

  console.log(`Intentando conectar a http://${options.hostname}:${options.port}${options.path}`);

  const req = http.request(options, res => {
    console.log(`Status Code: ${res.statusCode}`);
    let data = '';
  
    res.on('data', chunk => {
      data += chunk;
    });

    const http = require('http');

    console.log('Iniciando prueba del servidor...');

    // Simple health check
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/test',
      method: 'GET',
      timeout: 5000 // 5 segundos de timeout
    };

    console.log(`Intentando conectar a http://${options.hostname}:${options.port}${options.path}`);

    const req = http.request(options, res => {
      console.log(`Status Code: ${res.statusCode}`);
      let data = '';
  
      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Respuesta recibida:');
        console.log(data);
        process.exit(0);
      });
    });

    req.on('error', error => {
      console.error('Error al conectar con el servidor:');
      console.error(`- Código: ${error.code}`);
      console.error(`- Mensaje: ${error.message}`);
      console.error('\nPosibles causas:');
      console.error('1. El servidor no está corriendo');
      console.error('2. El puerto está bloqueado');
      console.error('3. Hay otro servicio usando el puerto 3000');
      process.exit(1);
    });

    req.on('timeout', () => {
      console.error('La conexión al servidor ha excedido el tiempo de espera');
      req.destroy();
      process.exit(1);
    });

    req.end();
