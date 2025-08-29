const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../../utils/config');

(async () => {
  const outPath = path.join(__dirname, 'save_webhook_result.json');
  try {
    const dbPath = path.join(__dirname, '..', 'database', 'ysnm_dashboard.db');
    const webhookUrl = 'https://discord.com/api/webhooks/1409372170743972091/MZ6aCMlvH4iCFP_9DiUloLYkY_TPXPwiWP1XUu5_IOcq8HLk3OHhYizE4eBxMxrIEtjq';
    const guildId = config.DISCORD.GUILD_ID || process.env.GUILD_ID || null;

    if (!guildId) {
      fs.writeFileSync(outPath, JSON.stringify({ success: false, error: 'guildId_not_found' }, null, 2));
      process.exit(1);
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        fs.writeFileSync(outPath, JSON.stringify({ success: false, error: 'db_open_error', message: err.message }, null, 2));
        process.exit(2);
      }
    });

    const sql = `INSERT OR REPLACE INTO guild_config (guild_id, config_key, value, updated_at) VALUES (?, 'archive_webhook_url', ?, CURRENT_TIMESTAMP)`;

    db.run(sql, [guildId, webhookUrl], function(err) {
      if (err) {
        fs.writeFileSync(outPath, JSON.stringify({ success: false, error: 'insert_error', message: err.message }, null, 2));
        db.close();
        process.exit(3);
      }

      db.get('SELECT id, guild_id, config_key, value, updated_at FROM guild_config WHERE guild_id = ? AND config_key = ?', [guildId, 'archive_webhook_url'], (err2, row) => {
        if (err2) {
          fs.writeFileSync(outPath, JSON.stringify({ success: false, error: 'select_error', message: err2.message }, null, 2));
          db.close();
          process.exit(4);
        }

        fs.writeFileSync(outPath, JSON.stringify({ success: true, row }, null, 2));
        db.close();
        process.exit(0);
      });
    });
  } catch (e) {
    try { fs.writeFileSync(path.join(__dirname, 'save_webhook_result.json'), JSON.stringify({ success: false, error: 'exception', message: e.message }, null, 2)); } catch(_){}
    process.exit(9);
  }
})();
