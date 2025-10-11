const express = require('express');
const app = express();

// Basic test endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
const port = 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Test server running at http://0.0.0.0:${port}`);
  console.log('Press Ctrl+C to stop');
});
