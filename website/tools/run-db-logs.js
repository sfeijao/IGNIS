const Database = require('../database/database');

(async () => {
  try {
    const db = new Database();
    await db.initialize();
    console.log('DB initialized');
    const logs = await db.getLogs({ guild_id: '1333820000791691284', limit: 5 });
    console.log('Logs:', logs.length);
    console.dir(logs, { depth: 2 });
    db.close();
  } catch (err) {
    console.error('Error calling getLogs:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
