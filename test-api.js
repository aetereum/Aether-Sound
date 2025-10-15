// test-api helper uses fetch; no need for node:http, path, or fs imports

async function runTests() {
  console.log('Iniciando pruebas de conectividad...\n');

  // Test 1: Verificar conexión básica
  try {
    console.log('Test 1: Conexión básica a la API...');
    const response = await fetch('http://localhost:8080/');
    const body = await response.text();
    console.log('✓ Conexión exitosa');
    console.log(`Respuesta: ${body.substring(0, 100)}...\n`);
  } catch (err) {
    console.error('✗ Error de conexión:', err.message, '\n');
  }

  // Test 2: Verificar endpoint de generación de batería
  try {
    console.log('Test 2: Probando generación de batería...');
    const response = await fetch('http://localhost:8080/generate-drums', {
      method: 'POST'
    });
    const data = await response.json();
    console.log('✓ Generación exitosa');
    console.log('Archivo generado:', data.file, '\n');
  } catch (err) {
    console.error('✗ Error generando batería:', err.message, '\n');
  }

  // Test 3: Verificar archivos estáticos
  try {
    console.log('Test 3: Accediendo a archivos estáticos...');
    const response = await fetch('http://localhost:8080/output/');
    console.log(`Status: ${response.status}`);
    if (response.ok) {
      console.log('✓ Acceso a archivos estáticos exitoso\n');
    } else {
      console.log('✗ Error accediendo a archivos estáticos\n');
    }
  } catch (err) {
    console.error('✗ Error de archivos estáticos:', err.message, '\n');
  }

  console.log('Pruebas completadas.');
}

runTests();
