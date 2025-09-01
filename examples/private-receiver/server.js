const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
// Normalize PRIVATE_LOG_TOKEN: trim and strip surrounding quotes if present
let TOKEN = process.env.PRIVATE_LOG_TOKEN ? process.env.PRIVATE_LOG_TOKEN.trim() : null;
if (TOKEN && ((TOKEN.startsWith('"') && TOKEN.endsWith('"')) || (TOKEN.startsWith("'") && TOKEN.endsWith("'")))) {
  TOKEN = TOKEN.slice(1, -1).trim();
}
// Log whether a token was detected (mask it) and show raw env form for debugging when run in background
console.log('PRIVATE_LOG_TOKEN:', TOKEN ? `${TOKEN.slice(0, 4)}... (hidden)` : 'not set');
console.log('PRIVATE_LOG_TOKEN_RAW:', JSON.stringify(process.env.PRIVATE_LOG_TOKEN), '=> NORMALIZED:', JSON.stringify(TOKEN), 'len=', TOKEN ? TOKEN.length : 0);
const RECEIVED_DIR = path.join(__dirname, 'received');
if (!fs.existsSync(RECEIVED_DIR)) fs.mkdirSync(RECEIVED_DIR, { recursive: true });

function badRequest(res, code, msg) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, message: msg }));
}

const server = http.createServer((req, res) => {
  if (req.url === '/hooks/tickets' && req.method === 'POST') {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  // allow an alternate test header for easier local testing
  const altToken = req.headers['x-private-log-token'] || req.headers['X-Private-Log-Token'];
  const authToken = auth && typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  const altTokenTrim = altToken && typeof altToken === 'string' ? altToken.trim() : null;
    if (TOKEN) {
      const ok = (authToken && authToken === TOKEN) || (altTokenTrim && altTokenTrim === TOKEN);
      if (!ok) {
        console.log('Unauthorized request, auth header=', JSON.stringify(authToken), 'x-private-log-token=', JSON.stringify(altTokenTrim));
        console.log('TOKEN===altToken?', TOKEN === altTokenTrim, 'TOKEN_len', TOKEN ? TOKEN.length : 0, 'alt_len', altTokenTrim ? altTokenTrim.length : 0);
        return badRequest(res, 401, 'Unauthorized');
      }
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const filename = path.join(
          RECEIVED_DIR,
          `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
        );
        fs.writeFileSync(
          filename,
          JSON.stringify({ receivedAt: new Date().toISOString(), headers: req.headers, data }, null, 2)
        );
        console.log('Saved payload to', filename);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, path: filename }));
      } catch (err) {
        console.error('Invalid JSON', err);
        return badRequest(res, 400, 'Invalid JSON');
      }
    });

    req.on('error', (err) => {
      console.error('Request error', err);
      badRequest(res, 500, 'Request error');
    });
  } else if (req.url === '/' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/plain');
    res.end('Private receiver running');
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
});

server.listen(PORT, () =>
  console.log(`Private receiver listening on http://localhost:${PORT}/hooks/tickets (token ${TOKEN ? 'enabled' : 'disabled'})`)
);
