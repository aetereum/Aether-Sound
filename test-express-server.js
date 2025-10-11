const express = require('express');
const path = require('node:path');
const fs = require('node:fs').promises;

// Crear la aplicación Express básica
const app = express();
const PORT = 8080; // Puerto más alto

// Configuración básica
app.use(express.json());

// Ruta de prueba simple
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Aether-Sound API funcionando' });
});

// Ruta de prueba para archivos estáticos
app.get('/test-static', (req, res) => {
  res.sendFile(path.join(__dirname, 'README.md'));
});

// Iniciar servidor
const startServer = async () => {
  try {
    // Asegurar que los directorios existan
    await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true });
    await fs.mkdir(path.join(__dirname, 'output'), { recursive: true });

    // Iniciar el servidor en todas las interfaces
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`
============================================
    Aether-Sound API - Modo de prueba
============================================
► Servidor iniciado en:
  - http://localhost:${PORT}
  - http://127.0.0.1:${PORT}
  
► Rutas disponibles:
  - GET /         → Prueba API
  - GET /test-static → Prueba archivos estáticos
  
► Para probar:
  Invoke-WebRequest http://localhost:${PORT}
  
► Presiona Ctrl+C para detener
============================================
`);
    });

    // Manejo de errores del servidor
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Error: Puerto ${PORT} en uso`);
        process.exit(1);
      }
      console.error('Error del servidor:', error);
      process.exit(1);
    });

  } catch (err) {
    console.error('Error al iniciar:', err);
    process.exit(1);
  }
};

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
  process.exit(1);
});

startServer();
