const assert = require('assert');
const crypto = require('crypto');
const path = require('path');

describe('privateLogger helpers', function() {
  it('computes expected signature length', function() {
    const payload = { foo: 'bar' };
    const secret = 'tstsecret';
    const body = JSON.stringify(payload);
    const bodyBuf = Buffer.from(body, 'utf8');
    const ts = Date.now();
    const sig = crypto.createHmac('sha256', secret).update(Buffer.concat([Buffer.from(String(ts) + '.'), bodyBuf])).digest('hex');
    assert.strictEqual(sig.length, 64);
  });
});
