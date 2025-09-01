const assert = require('assert');
const http = require('http');
const crypto = require('crypto');

describe('invalid signature', function() {
  it('returns 401 for wrong HMAC signature', function(done) {
    this.timeout(5000);
    const payload = { event: 'invalid_sig', value: 1 };
    const raw = Buffer.from(JSON.stringify(payload));
    const ts = Date.now();
    // compute signature with wrong secret
    const wrongSig = 'sha256=' + crypto.createHmac('sha256', 'wrongsecret').update(Buffer.concat([Buffer.from(String(ts) + '.'), raw])).digest('hex');

    const options = { hostname: '127.0.0.1', port: 3001, path: '/hooks/tickets', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': raw.length, 'Authorization': 'Bearer testtoken', 'X-Signature': wrongSig, 'X-Timestamp': String(ts) } };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          assert.strictEqual(res.statusCode, 401);
          done();
        } catch (e) { done(e); }
      });
    });
    req.on('error', done);
    req.write(raw);
    req.end();
  });
});
