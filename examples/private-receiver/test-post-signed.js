const http = require('http');
const crypto = require('crypto');

const PAYLOAD = {
  event: 'ticket_closed',
  ticket: { id: 1003, guild_id: '987654321', subject: 'Teste final' },
  messages: [ { content: 'Teste final payload', author: 'User#0001', ts: new Date().toISOString() } ]
};

const HMAC = process.env.PRIVATE_LOG_HMAC_SECRET || 'testsecret';
const TOKEN = process.env.PRIVATE_LOG_TOKEN || 'testtoken';
const PORT = process.env.PORT || 3001;

const raw = Buffer.from(JSON.stringify(PAYLOAD));
const ts = Date.now();
const signature = 'sha256=' + crypto.createHmac('sha256', HMAC).update(Buffer.concat([Buffer.from(String(ts) + '.'), raw])).digest('hex');

const options = {
  hostname: '127.0.0.1',
  port: PORT,
  path: '/hooks/tickets',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': raw.length,
    'Authorization': `Bearer ${TOKEN}`,
  'X-Signature': signature,
  'X-Timestamp': String(ts)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (c) => body += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});

req.on('error', (err) => console.error('Request error', err));
req.write(raw);
req.end();
