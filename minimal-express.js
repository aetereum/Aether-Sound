const express = require('express');
const app = express();

// Configuración mínima
app.disable('x-powered-by');
app.disable('etag');

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('OK');
});

// Iniciar servidor en un puerto alto
const PORT = 8888;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor de prueba escuchando en http://127.0.0.1:${PORT}`);
});
