const assert = require('assert');
const crypto = require('crypto');

// Stub fetch before requiring the module so its internal `fetch` binding picks our stub
let captured = null;
global.fetch = async function(url, opts) {
  captured = opts;
  return { ok: true, status: 200, statusText: 'OK' };
};

const { sendToPrivateEndpoint } = require('../../../website/utils/privateLogger');

describe('privateLogger helper (unit)', function() {
  it('computes a timestamped sha256 signature header when hmacSecret provided', async function() {
    const url = 'http://localhost:3001/hooks/tickets';
    const secret = 'unit-test-secret';
    const payload = { x: 42 };

    const sent = await sendToPrivateEndpoint(url, null, payload, { hmacSecret: secret, maxAttempts: 1 });
    assert.strictEqual(sent, true);
    assert.ok(captured, 'fetch was called');
    const headers = captured.headers;
    assert.ok(headers['X-Timestamp'] || headers['x-timestamp']);
    const ts = headers['X-Timestamp'] || headers['x-timestamp'];
    const bodyBuf = Buffer.from(JSON.stringify(payload), 'utf8');
    const expectedSig = crypto.createHmac('sha256', secret).update(Buffer.concat([Buffer.from(String(ts) + '.'), bodyBuf])).digest('hex');
    const sigHeader = headers['X-Signature'] || headers['x-signature'];
    assert.strictEqual(sigHeader, `sha256=${expectedSig}`);
  });
});
