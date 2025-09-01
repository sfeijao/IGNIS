const http = require('http');
const crypto = require('crypto');

// Sends the same signed payload twice to test replay protection
const PAYLOAD = { event: 'replay_test', ticket: { id: 9001 }, messages: [{ content: 'replay', author: 'tester', ts: new Date().toISOString() }] };
const HMAC = process.env.PRIVATE_LOG_HMAC_SECRET || 'testsecret';
const TOKEN = process.env.PRIVATE_LOG_TOKEN || 'testtoken';
const PORT = process.env.PORT || 3001;

function sendWith(signature, ts, cb) {
  const raw = Buffer.from(JSON.stringify(PAYLOAD));
  const options = {
    hostname: '127.0.0.1', port: PORT, path: '/hooks/tickets', method: 'POST', headers: {
      'Content-Type': 'application/json', 'Content-Length': raw.length, 'Authorization': `Bearer ${TOKEN}`,
      'X-Signature': signature, 'X-Timestamp': String(ts)
    }
  };
  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => cb(null, res.statusCode, body));
  });
  req.on('error', (e) => cb(e));
  req.write(raw);
  req.end();
}

(async () => {
  const raw = Buffer.from(JSON.stringify(PAYLOAD));
  const ts = Date.now();
  const signature = 'sha256=' + crypto.createHmac('sha256', HMAC).update(Buffer.concat([Buffer.from(String(ts) + '.'), raw])).digest('hex');

  await new Promise(r => sendWith(signature, ts, (e,s,b)=>{ console.log('first', e||s, b); r(); }));
  await new Promise(r => setTimeout(r, 200));
  await new Promise(r => sendWith(signature, ts, (e,s,b)=>{ console.log('second', e||s, b); r(); }));
})();
