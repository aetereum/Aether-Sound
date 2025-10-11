// Script temporal para arrancar server.js y capturar errores de carga
try {
  require('../server.js');
  console.log('server.js importado correctamente (debug wrapper)');
} catch (err) {
  console.error('Error al cargar server.js:', err && err.stack ? err.stack : err);
  process.exit(1);
}
