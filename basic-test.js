const express = require('express');
const app = express();

// Solo middleware esencial
app.use(express.json());

// Ruta de prueba simple
app.get('/', (req, res) => {
  res.send('Aether-Sound API funcionando');
});

// Puerto alto y escuchar en todas las interfaces
const PORT = 9000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de prueba en http://localhost:${PORT}`);
});
