const http = require('http');

const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 segundos
let attempt = 0;

function runTest() {
  attempt++;
  console.log(`Iniciando prueba del servidor (intento ${attempt}/${MAX_RETRIES})...`);

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/test',
    method: 'GET',
    timeout: 5000 // 5 segundos de timeout
  };

  console.log(`Intentando conectar a http://${options.hostname}:${options.port}${options.path}`);

  const req = http.request(options, res => {
    console.log(`✅ ¡Conexión exitosa! Status Code: ${res.statusCode}`);
    let data = '';

    res.on('data', chunk => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Respuesta recibida:');
      try {
        const jsonData = JSON.parse(data);
        console.log(jsonData);
        if (jsonData.success) {
          console.log('\n🎉 ¡El servidor está funcionando correctamente!');
          process.exit(0);
        } else {
          console.error('\n❌ El servidor respondió, pero la prueba falló.');
          process.exit(1);
        }
      } catch {
        console.error('\n❌ La respuesta del servidor no es un JSON válido.');
        console.log(data);
        process.exit(1);
      }
    });
  });

  req.on('error', (_e) => {
    console.error(`Error en el intento ${attempt}: ${_e.message}`);
    if (attempt < MAX_RETRIES) {
      console.log(`Reintentando en ${RETRY_DELAY / 1000} segundos...`);
      setTimeout(runTest, RETRY_DELAY);
    } else {
      console.error('\n❌ No se pudo conectar con el servidor después de varios intentos. Posibles causas:');
      console.error('1. El servidor falló al iniciar. Revisa la otra terminal para ver si hay errores de arranque.');
      console.error('2. El servidor está corriendo en un puerto diferente al 3000.');
      console.error('3. Un firewall está bloqueando la conexión local.');
      process.exit(1);
    }
  });

  req.end();
}

runTest();
