const assert = require('assert');
const http = require('http');

describe('oversize payload', function() {
  it('returns 413 when payload exceeds 5MB', function(done) {
    this.timeout(10000);
    // create a payload slightly larger than 5MB
    const size = 5 * 1024 * 1024 + 10;
    const big = Buffer.alloc(size, 'a');
    const options = { hostname: '127.0.0.1', port: 3001, path: '/hooks/tickets', method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': big.length, 'Authorization': 'Bearer testtoken' } };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          assert.strictEqual(res.statusCode, 413);
          done();
        } catch (e) { done(e); }
      });
    });
    req.on('error', done);
    req.write(big);
    req.end();
  });
});
