const express = require('express');
const app = express();

// Desactivar características que podrían causar problemas
app.disable('x-powered-by');
app.disable('etag');

// Middleware mínimo
app.use(express.json());

// Ruta básica
app.get('/', (req, res) => {
  res.send('OK');
});

// Puerto alto para evitar restricciones
const PORT = 9999;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
========================================
    Express Test Server
========================================
Server running on all interfaces:
- http://localhost:${PORT}
- http://127.0.0.1:${PORT}
- http://[your-ip]:${PORT}

Press Ctrl+C to stop
========================================
`);
});
