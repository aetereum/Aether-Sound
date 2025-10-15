const http = require('node:http');

// Crear servidor HTTP básico
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Servidor funcionando\n');
});

// Encontrar un puerto disponible
function findPort(start) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const tester = http.createServer();
      tester.once('error', (_err) => {
        if (_err.code === 'EADDRINUSE') {
          tryPort(port + 1);
        } else {
          reject(_err);
        }
      });
      tester.once('listening', () => {
        tester.close(() => resolve(port));
      });
      tester.listen(port, '127.0.0.1');
    };
    tryPort(start);
  });
}

// Iniciar servidor
async function startServer() {
  try {
    // Intentar puertos comunes en orden
    const ports = [3000, 8080, 8000, 5000];
    let port;

    for (const p of ports) {
      try {
        port = await findPort(p);
        break;
      } catch {
        console.log(`Puerto ${p} no disponible, probando siguiente...`);
        continue;
      }
    }

    if (!port) {
      console.error('No se encontró ningún puerto disponible');
      process.exit(1);
    }

    server.listen(port, '127.0.0.1', () => {
      console.log(`
=========================================
    Servidor HTTP Básico
=========================================
Servidor escuchando en:
http://127.0.0.1:${port}

Para probar, abre en tu navegador:
http://localhost:${port}

O ejecuta en terminal:
curl http://localhost:${port}
=========================================
`);
    });

    } catch (_err) {
      console.error('Error iniciando servidor:', _err);
      process.exit(1);
    }
}

// Manejo de errores
server.on('error', (_error) => {
  console.error('Error en el servidor:', _error);
  process.exit(1);
});

process.on('uncaughtException', (_error) => {
  console.error('Error no capturado:', _error);
  process.exit(1);
});

// Iniciar servidor
startServer();
