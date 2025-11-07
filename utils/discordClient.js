let cached = null;
function getClient(){
  if (cached) return cached;
  try {
    // Main bot client exported from index.js
    // Note: requiring index.js may start the server and bot; in runtime it's already loaded.
    // We only need the exported client reference.
    // eslint-disable-next-line global-require
    cached = require('../index.js');
  } catch (e) {
    cached = null;
  }
  return cached;
}
module.exports = { getClient };
