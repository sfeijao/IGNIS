const assert = require('assert');

describe('privateLogger retry behavior', function() {
  it('retries on failure and succeeds before maxAttempts', async function() {
    this.timeout(5000);
    // stub global.fetch to fail twice then succeed
    let calls = 0;
    global.fetch = async function(url, opts) {
      calls++;
      if (calls < 3) {
        throw new Error('simulated network error');
      }
      return { ok: true, status: 200, statusText: 'OK' };
    };

    // reload module so it binds our stubbed global.fetch
    delete require.cache[require.resolve('../../../website/utils/privateLogger')];
    const { sendToPrivateEndpoint } = require('../../../website/utils/privateLogger');

    const sent = await sendToPrivateEndpoint('http://localhost:3001/hooks/tickets', null, { a: 1 }, { maxAttempts: 3, timeoutMs: 2000 });
    assert.strictEqual(sent, true);
    assert.strictEqual(calls, 3);
  });
});
