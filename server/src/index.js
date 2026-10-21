const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Cesta ke složce klienta
const CLIENT_DIR = path.resolve(__dirname, '../../client');

// Middleware pro logování požadavků
app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${req.method} ${req.url}`);
  next();
});

// Statické servírování souborů klienta (HTML, CSS, JS, assety)
app.use(express.static(CLIENT_DIR));

// Základní stavový endpoint pro API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    game: 'RTS Strategy Game',
    version: '1.0.0',
    timestamp: Date.now()
  });
});

// Fallback: všechny ostatní požadavky nahrají hlavní stránku klienta
app.use((req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

// Spuštění serveru
app.listen(PORT, () => {
  console.log('========================================================');
  console.log(`🏰 RTS Hra Server běží na: http://localhost:${PORT}`);
  console.log(`📁 Složka klienta: ${CLIENT_DIR}`);
  console.log('========================================================');
});
