const net = require('node:net');

const port = process.argv[2] || 8000;

console.log(`Intentando conexión TCP al puerto ${port}...`);

const client = new net.Socket();

client.connect(port, '127.0.0.1', () => {
  console.log('Conectado al servidor');
  client.write('Hola servidor');
});

client.on('data', (data) => {
  console.log('Respuesta recibida:', data.toString());
  client.end();
});

client.on('close', () => {
  console.log('Conexión cerrada');
});

client.on('error', (error) => {
  if (error.code === 'ECONNREFUSED') {
    console.log(`
=========================================
    Error de Conexión
=========================================
El servidor no está respondiendo en el puerto ${port}.
Posibles causas:
1. El servidor no está ejecutándose
2. El puerto está bloqueado
3. El firewall está bloqueando la conexión

Soluciones:
1. Asegúrate de que el servidor esté corriendo
2. Intenta con un puerto diferente
3. Verifica la configuración del firewall
=========================================
`);
  } else {
    console.error('Error:', error.message);
  }
});
