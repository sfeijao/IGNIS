const assert = require('assert');
const http = require('http');
const crypto = require('crypto');

describe('receiver HMAC integration', function() {
  it('accepts valid HMAC signed request when server running', function(done) {
    this.timeout(5000);
    const PAYLOAD = { event: 'hmac_test', x: 1 };
    const raw = Buffer.from(JSON.stringify(PAYLOAD));
    const ts = Date.now();
    const signature = 'sha256=' + crypto.createHmac('sha256', 'testsecret').update(Buffer.concat([Buffer.from(String(ts) + '.'), raw])).digest('hex');

    const options = { hostname: '127.0.0.1', port: 3001, path: '/hooks/tickets', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': raw.length, 'Authorization': 'Bearer testtoken', 'X-Signature': signature, 'X-Timestamp': String(ts) } };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          assert.strictEqual(res.statusCode, 200);
          done();
        } catch (e) { done(e); }
      });
    });
    req.on('error', (e) => done(e));
    req.write(raw);
    req.end();
  });
});
