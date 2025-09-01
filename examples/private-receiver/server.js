const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3001;

// Normalize PRIVATE_LOG_TOKEN: trim and strip surrounding quotes if present
let TOKEN = process.env.PRIVATE_LOG_TOKEN ? process.env.PRIVATE_LOG_TOKEN.trim() : null;
if (TOKEN && ((TOKEN.startsWith('"') && TOKEN.endsWith('"')) || (TOKEN.startsWith("'") && TOKEN.endsWith("'")))) {
  TOKEN = TOKEN.slice(1, -1).trim();
}

// Optional HMAC secret (sha256). When set, the receiver requires a matching
// signature header (x-signature or x-hub-signature-256). If both TOKEN and
// HMAC are set, both checks are applied.
let HMAC_SECRET = process.env.PRIVATE_LOG_HMAC_SECRET ? process.env.PRIVATE_LOG_HMAC_SECRET.trim() : null;
if (HMAC_SECRET && ((HMAC_SECRET.startsWith('"') && HMAC_SECRET.endsWith('"')) || (HMAC_SECRET.startsWith("'") && HMAC_SECRET.endsWith("'")))) {
  HMAC_SECRET = HMAC_SECRET.slice(1, -1).trim();
}
// HMAC replay protection TTL in seconds (default 300s)
const HMAC_TTL = process.env.PRIVATE_LOG_HMAC_TTL ? parseInt(process.env.PRIVATE_LOG_HMAC_TTL, 10) : 300;
// Simple in-memory replay cache to prevent identical signature reuse within TTL
const replayCache = new Map(); // key -> expiry(ms)
function cleanupReplayCache() {
  const now = Date.now();
  for (const [k, v] of replayCache.entries()) {
    if (v <= now) replayCache.delete(k);
  }
}
setInterval(cleanupReplayCache, 60 * 1000).unref();
// Persistent cache file to survive restarts
const REPLAY_FILE = path.join(__dirname, 'replay-cache.json');
// Max number of replay entries to persist to disk to avoid unbounded growth
const MAX_REPLAY_ENTRIES = process.env.PRIVATE_LOG_REPLAY_MAX_ENTRIES ? parseInt(process.env.PRIVATE_LOG_REPLAY_MAX_ENTRIES, 10) : 2000;
// Optional sqlite mode for replay persistence
const USE_SQLITE = process.env.PRIVATE_LOG_USE_SQLITE === '1' || process.env.PRIVATE_LOG_USE_SQLITE === 'true';
const SQLITE_FILE = path.join(__dirname, 'replay-cache.sqlite');
let sqliteDb = null;
if (USE_SQLITE) {
  try {
    const Database = require('better-sqlite3');
    sqliteDb = new Database(SQLITE_FILE);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.prepare('CREATE TABLE IF NOT EXISTS replays(sig TEXT PRIMARY KEY, expiry INTEGER)').run();
    sqliteDb.prepare('CREATE INDEX IF NOT EXISTS idx_replays_expiry ON replays(expiry)').run();
  } catch (e) {
    console.warn('Failed to init sqlite replay DB, falling back to file/map:', e && e.message ? e.message : e);
    sqliteDb = null;
  }
}
function loadReplayCacheFromDisk() {
  try {
    if (!fs.existsSync(REPLAY_FILE)) return;
    const raw = fs.readFileSync(REPLAY_FILE, 'utf8');
    const obj = JSON.parse(raw || '{}');
    const now = Date.now();
    for (const [k, v] of Object.entries(obj)) {
      const exp = Number(v) || 0;
      if (exp > now) replayCache.set(k, exp);
    }
  } catch (e) {
    if (process.env.DEBUG_PRIVATE_RECEIVER === '1') console.warn('DEBUG: failed to load replay cache', e && e.message ? e.message : e);
  }
}
let _saveTimeout = null;
function scheduleSaveReplayCache() {
  if (_saveTimeout) clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(() => {
    try {
  // Create a shallow array of entries then sort by expiry desc and keep newest entries
  const entries = Array.from(replayCache.entries());
  // Remove expired entries first
  const now = Date.now();
  const filtered = entries.filter(([k, v]) => v > now);
  // Sort by expiry descending (keep latest expiries)
  filtered.sort((a, b) => b[1] - a[1]);
  const toKeep = filtered.slice(0, MAX_REPLAY_ENTRIES);
  const dump = {};
  for (const [k, v] of toKeep) dump[k] = v;
  fs.writeFileSync(REPLAY_FILE, JSON.stringify(dump), { encoding: 'utf8' });
    } catch (e) {
      if (process.env.DEBUG_PRIVATE_RECEIVER === '1') console.warn('DEBUG: failed to save replay cache', e && e.message ? e.message : e);
    }
    _saveTimeout = null;
  }, 500);
}

function flushReplayCacheToDisk() {
  if (_saveTimeout) clearTimeout(_saveTimeout);
  try {
  if (sqliteDb) {
    // prune expired
    const now = Date.now();
    sqliteDb.prepare('DELETE FROM replays WHERE expiry <= ?').run(now);
    // keep MAX_REPLAY_ENTRIES newest expiries
    const rows = sqliteDb.prepare('SELECT sig, expiry FROM replays ORDER BY expiry DESC LIMIT ?').all(MAX_REPLAY_ENTRIES);
    // recreate table to trim entries
    const tmp = sqliteDb.transaction(() => {
      sqliteDb.prepare('DELETE FROM replays').run();
      const ins = sqliteDb.prepare('INSERT INTO replays(sig, expiry) VALUES (?,?)');
      for (const r of rows) ins.run(r.sig, r.expiry);
    });
    tmp();
  } else {
    const entries = Array.from(replayCache.entries());
    const now = Date.now();
    const filtered = entries.filter(([k, v]) => v > now);
    filtered.sort((a, b) => b[1] - a[1]);
    const toKeep = filtered.slice(0, MAX_REPLAY_ENTRIES);
    const dump = {};
    for (const [k, v] of toKeep) dump[k] = v;
    fs.writeFileSync(REPLAY_FILE, JSON.stringify(dump), { encoding: 'utf8' });
  }
  } catch (e) {
    if (process.env.DEBUG_PRIVATE_RECEIVER === '1') console.warn('DEBUG: failed to flush replay cache', e && e.message ? e.message : e);
  }
}

// load at startup
loadReplayCacheFromDisk();
process.on('exit', flushReplayCacheToDisk);
process.on('SIGINT', () => { flushReplayCacheToDisk(); process.exit(0); });
process.on('SIGTERM', () => { flushReplayCacheToDisk(); process.exit(0); });

const RECEIVED_DIR = path.join(__dirname, 'received');
if (!fs.existsSync(RECEIVED_DIR)) fs.mkdirSync(RECEIVED_DIR, { recursive: true });

function jsonResponse(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (req.url === '/hooks/tickets' && req.method === 'POST') {
    const auth = req.headers['authorization'];
    const authToken = auth && typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;

    if (TOKEN) {
      if (!authToken || authToken !== TOKEN) {
        return jsonResponse(res, 401, { ok: false, message: 'Unauthorized (token)' });
      }
    }

    // Accumulate raw bytes to allow HMAC verification over the exact payload.
    const chunks = [];
    let sizeBytes = 0;
    const MAX_BYTES = 5 * 1024 * 1024; // 5MB

    req.on('data', (chunk) => {
      sizeBytes += chunk.length;
      if (sizeBytes > MAX_BYTES) {
        // Too large
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, message: 'Payload too large' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks);

        // If HMAC_SECRET is set, require signature header and verify it.
        if (HMAC_SECRET) {
          const provided = req.headers['x-signature'] || req.headers['x-hub-signature-256'] || req.headers['x-signature-256'];
          if (!provided || typeof provided !== 'string') {
            return jsonResponse(res, 401, { ok: false, message: 'Missing signature header' });
          }

          const providedHex = provided.replace(/^sha256=/i, '').trim();

          // Support optional timestamp-based signing: if client provided x-timestamp, verify age and use it in signature
          const tsHeader = req.headers['x-timestamp'] || req.headers['x-signature-timestamp'];
          let expectedHex;
          if (tsHeader) {
            const ts = String(tsHeader).trim();
            const tsNum = Number(ts);
            if (!tsNum || Number.isNaN(tsNum)) {
              return jsonResponse(res, 400, { ok: false, message: 'Invalid timestamp header' });
            }
            const age = Math.abs(Date.now() - tsNum) / 1000;
            if (age > HMAC_TTL) {
              return jsonResponse(res, 401, { ok: false, message: 'Signature timestamp expired' });
            }
            // Build buffer: <timestamp-as-string> + '.' + raw bytes
            const buf = Buffer.concat([Buffer.from(String(ts) + '.'), raw]);
            expectedHex = crypto.createHmac('sha256', HMAC_SECRET).update(buf).digest('hex');
          } else {
            // Fallback: legacy signing over body only
            expectedHex = crypto.createHmac('sha256', HMAC_SECRET).update(raw).digest('hex');
          }

          // Timing-safe compare
          try {
            const a = Buffer.from(providedHex, 'hex');
            const b = Buffer.from(expectedHex, 'hex');
            if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
              if (process.env.DEBUG_PRIVATE_RECEIVER === '1') {
                console.warn('DEBUG: signature mismatch, provided=', providedHex, 'expected=', expectedHex);
              }
              return jsonResponse(res, 401, { ok: false, message: 'Invalid signature' });
            }

            // Replay detection: use the full provided signature string (hex) as key
            const replayKey = providedHex;
            const now = Date.now();
            if (sqliteDb) {
              // check DB
              const row = sqliteDb.prepare('SELECT expiry FROM replays WHERE sig = ?').get(replayKey);
              if (row && Number(row.expiry) > now) {
                return jsonResponse(res, 401, { ok: false, message: 'Replay detected' });
              }
              // insert or replace with new expiry
              const expiry = now + (HMAC_TTL * 1000);
              sqliteDb.prepare('INSERT OR REPLACE INTO replays(sig, expiry) VALUES (?,?)').run(replayKey, expiry);
              // schedule a flush (we still reuse flush logic to prune)
              scheduleSaveReplayCache();
            } else {
              if (replayCache.has(replayKey)) {
                return jsonResponse(res, 401, { ok: false, message: 'Replay detected' });
              }
              // mark as seen until now + TTL
              replayCache.set(replayKey, now + (HMAC_TTL * 1000));
              scheduleSaveReplayCache();
            }

          } catch (e) {
            if (process.env.DEBUG_PRIVATE_RECEIVER === '1') console.warn('DEBUG: signature compare error', e && e.message ? e.message : e);
            return jsonResponse(res, 401, { ok: false, message: 'Invalid signature format' });
          }
        }

        const data = raw && raw.length ? JSON.parse(raw.toString('utf8')) : {};
        const filename = path.join(RECEIVED_DIR, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
        fs.writeFileSync(filename, JSON.stringify({ receivedAt: new Date().toISOString(), headers: req.headers, data }, null, 2));
        console.log(`Saved payload: ${path.relative(process.cwd(), filename)}`);
        return jsonResponse(res, 200, { ok: true, path: filename });
      } catch (err) {
        return jsonResponse(res, 400, { ok: false, message: 'Invalid JSON' });
      }
    });

    req.on('error', (err) => {
      console.error('Request error', err);
      return jsonResponse(res, 500, { ok: false, message: 'Request error' });
    });
  } else if (req.url === '/' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/plain');
    res.end('Private receiver running');
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
});

server.listen(PORT, () => console.log(`Private receiver listening on http://localhost:${PORT}/hooks/tickets (token ${TOKEN ? 'enabled' : 'disabled'})`));
