const http = require('node:http');

// Crear servidor HTTP básico
const server = http.createServer(async (req, res) => {
  console.log(`Recibida petición: ${req.method} ${req.url}`);

  // Endpoint de prueba
  if (req.url === '/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Servidor funcionando' }));
    return;
  }

  // Página principal
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
            <html>
                <head><title>Aether-Sound Test</title></head>
                <body>
                    <h1>Servidor Aether-Sound Funcionando</h1>
                    <p>Esta es una página de prueba.</p>
                    <button onclick="testServer()">Probar Conexión</button>
                    <div id="result"></div>
                    <script>
                        async function testServer() {
                            try {
                                const response = await fetch('/test');
                                const data = await response.json();
                                document.getElementById('result').innerHTML = 
                                    '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                            } catch (error) {
                                document.getElementById('result').innerHTML = 
                                    '<p style="color: red">Error: ' + error.message + '</p>';
                            }
                        }
                    </script>
                </body>
            </html>
        `);
    return;
  }

  // 404 para otras rutas
  res.writeHead(404);
  res.end('Not Found');
});

// Configuración del servidor
const PORT = 3000;
const HOST = '0.0.0.0';

// Iniciar servidor
server.listen(PORT, HOST, () => {
  console.log(`
=========================================
    Servidor de Prueba Aether-Sound
=========================================
✓ Servidor iniciado
✓ Puerto: ${PORT}
✓ Host: ${HOST}

URLs de acceso:
- http://localhost:${PORT}
- http://127.0.0.1:${PORT}

Endpoints disponibles:
- GET /      → Página principal
- GET /test  → Prueba de API

Presiona Ctrl+C para detener
=========================================
`);
});

// Manejo de errores
server.on('error', (_error) => {
  if (_error.code === 'EADDRINUSE') {
    console.error(`Error: Puerto ${PORT} en uso`);
    process.exit(1);
  }
  console.error('Error del servidor:', _error);
  process.exit(1);
});

// Manejo de señales de terminación
process.on('SIGTERM', () => {
  console.log('\nRecibida señal SIGTERM');
  server.close(() => {
    console.log('Servidor detenido correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nRecibida señal SIGINT');
  server.close(() => {
    console.log('Servidor detenido correctamente');
    process.exit(0);
  });
});
