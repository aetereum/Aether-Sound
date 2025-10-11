const fetch = require('node-fetch');

(async () => {
  try {
    const payload = { query: 'conectar todas las pistas del mundo y componer', maxItems: 5 };
    const res = await fetch('http://localhost:3000/api/ai/search-compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log(text);
    if (!res.ok) process.exit(1);
  } catch (err) {
    console.error('Request failed:', err);
    process.exit(1);
  }
})();
