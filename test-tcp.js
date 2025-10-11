const net = require('node:net');

const client = new net.Socket();

console.log('Intentando conexión TCP básica...');

client.connect(8000, '127.0.0.1', () => {
  console.log('Conexión establecida');
  client.end();
});

client.on('error', (err) => {
  console.error('Error de conexión:', err.message);
  process.exit(1);
});

client.on('close', () => {
  console.log('Conexión cerrada');
  process.exit(0);
});
