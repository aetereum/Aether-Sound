const express = require('express');
const app = express();

// Disable all middleware temporarily
app.disable('x-powered-by');
app.disable('etag');

// Basic test endpoint
app.get('/', (req, res) => {
  res.send('OK');
});

const PORT = 4000;
const HOST = '10.34.90.24';

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
  console.log('Try accessing:');
  console.log(`1. http://${HOST}:${PORT}/`);
  console.log(`2. http://localhost:${PORT}/`);
});
