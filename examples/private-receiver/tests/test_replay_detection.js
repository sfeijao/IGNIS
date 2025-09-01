const assert = require('assert');
const http = require('http');
const crypto = require('crypto');

describe('replay detection', function() {
  it('rejects the second identical signed request', function(done) {
    this.timeout(8000);
    const PAYLOAD = { event: 'replay_test', v: Math.random() };
    const raw = Buffer.from(JSON.stringify(PAYLOAD));
    const ts = Date.now();
    const signature = 'sha256=' + crypto.createHmac('sha256', 'testsecret').update(Buffer.concat([Buffer.from(String(ts) + '.'), raw])).digest('hex');

    const options = { hostname: '127.0.0.1', port: 3001, path: '/hooks/tickets', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': raw.length, 'Authorization': 'Bearer testtoken', 'X-Signature': signature, 'X-Timestamp': String(ts) } };

    function send(cb) {
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => cb(null, res.statusCode, body));
      });
      req.on('error', cb);
      req.write(raw);
      req.end();
    }

    send((err, status1) => {
      if (err) return done(err);
      // send again with same signature
      send((err2, status2) => {
        if (err2) return done(err2);
        try {
          assert.strictEqual(status1, 200);
          assert.ok(status2 === 401 || status2 === 403, 'expected second to be rejected');
          done();
        } catch (e) { done(e); }
      });
    });
  });
});
