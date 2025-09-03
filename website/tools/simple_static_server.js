const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Serve static folders used by the frontend
app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'public', 'js')));
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets')));

// Simple bypass middleware to simulate authenticated requests when testing
app.use((req, res, next) => {
  // allow bypass explicitly via env
  if (process.env.ALLOW_LOCAL_AUTH_BYPASS === 'true') {
    req.user = { id: 'local-test', username: 'LocalTester' };
  }
  next();
});

// Serve a few public pages the smoke test expects
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')));
app.get('/tickets.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'tickets.html')));
app.get('/debug.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'debug.html')));

// Fallback to serving files directly from public
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`Simple static server listening on http://localhost:${PORT}`);
});
