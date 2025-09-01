const assert = require('assert');
const http = require('http');

describe('missing token', function() {
  it('returns 401 when Authorization header missing or wrong', function(done) {
    this.timeout(5000);
    const payload = { event: 'no_token' };
    const raw = Buffer.from(JSON.stringify(payload));

    const options = { hostname: '127.0.0.1', port: 3001, path: '/hooks/tickets', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': raw.length } };
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
