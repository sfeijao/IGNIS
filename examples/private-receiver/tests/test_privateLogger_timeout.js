const assert = require('assert');

describe('privateLogger timeout behavior', function() {
  it('aborts request on timeout and ultimately returns false', async function() {
    this.timeout(8000);
    // stub global.fetch to hang until aborted
    global.fetch = async function(url, opts) {
      return new Promise((resolve, reject) => {
        // never resolve; rely on AbortController to abort
      });
    };

    delete require.cache[require.resolve('../../../website/utils/privateLogger')];
    const { sendToPrivateEndpoint } = require('../../../website/utils/privateLogger');

    const sent = await sendToPrivateEndpoint('http://localhost:3001/hooks/tickets', null, { a: 1 }, { maxAttempts: 1, timeoutMs: 100 });
    assert.strictEqual(sent, false);
  });
});
