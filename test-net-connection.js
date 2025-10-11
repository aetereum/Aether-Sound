const net = require('node:net');

const client = new net.Socket();

client.connect(8888, '127.0.0.1', () => {
  console.log('Conexión establecida');
  client.write('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
});

client.on('data', (data) => {
  console.log('Datos recibidos:', data.toString());
  client.end();
});

client.on('error', (error) => {
  console.error('Error de conexión:', error.message);
  process.exit(1);
});

client.on('close', () => {
  console.log('Conexión cerrada');
  process.exit(0);
});
