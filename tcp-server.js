const net = require('node:net');

// Crear servidor TCP
const server = net.createServer((socket) => {
  console.log('Cliente conectado');
  socket.write('Conexión establecida\r\n');

  socket.on('data', (data) => {
    console.log('Datos recibidos:', data.toString());
    socket.write(`Eco: ${data}\r\n`);
  });

  socket.on('end', () => {
    console.log('Cliente desconectado');
  });
});

// Manejar errores del servidor
server.on('error', (err) => {
  console.error('Error del servidor:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.log('Puerto en uso, intentando otro...');
    setTimeout(() => {
      server.close();
      server.listen(0, '127.0.0.1');
    }, 1000);
  }
});

// Escuchar en cualquier puerto disponible
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  console.log(`
=========================================
    Servidor TCP básico
=========================================
Escuchando en:
- Puerto: ${address.port}
- Host: ${address.address}

Para probar, ejecuta en otra terminal:
node test-tcp-client.js ${address.port}
=========================================
`);
});
