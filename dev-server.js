const express = require('express');
const path = require('node:path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware for parsing JSON and urlencoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for development
app.use((req, res, _next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  _next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname)));

// Serve static files from the output directory
app.use('/output', express.static(path.join(__dirname, 'output')));

// Main route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: 'development' });
});

// Add your existing API endpoints here
app.post('/generate-drums', (req, res) => {
  // Your drum generation logic
  res.json({ message: 'Drum generation endpoint' });
});

app.post('/generate-composition', (req, res) => {
  // Your composition generation logic
  res.json({ message: 'Composition generation endpoint' });
});

app.post('/generate-synth', (req, res) => {
  // Your synth generation logic
  res.json({ message: 'Synth generation endpoint' });
});

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Development-specific logging middleware
app.use((req, res, _next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  _next();
});

app.listen(port, '127.0.0.1', () => {
  console.log('='.repeat(42));
  console.log('    Aether-Sound Development Server');
  console.log('='.repeat(42));
  console.log('✓ Server running in development mode');
  console.log(`✓ Port: ${port}`);
  console.log(`✓ URL: http://localhost:${port}`);
  console.log('\nAvailable endpoints:');
  console.log('- GET  /          → Web interface');
  console.log('- GET  /api/health → Server status');
  console.log('- POST /generate-drums      → Generate drums');
  console.log('- POST /generate-composition → Generate composition');
  console.log('- POST /generate-synth      → Generate synth');
  console.log('\nPress Ctrl+C to stop the server');
  console.log('='.repeat(42));
});
