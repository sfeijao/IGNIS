const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('../../utils/config');

const dbPath = path.join(__dirname, '..', 'database', 'ysnm_dashboard.db');
const webhookUrl = 'https://discord.com/api/webhooks/1409372170743972091/MZ6aCMlvH4iCFP_9DiUloLYkY_TPXPwiWP1XUu5_IOcq8HLk3OHhYizE4eBxMxrIEtjq';
const guildId = config.DISCORD.GUILD_ID || process.env.GUILD_ID;

if (!guildId) {
  console.error('Guild ID not found in config or env');
  process.exit(1);
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Failed to open DB', err.message);
    process.exit(2);
  }

  const sql = `INSERT OR REPLACE INTO guild_config (guild_id, config_key, value, updated_at) VALUES (?, 'archive_webhook_url', ?, CURRENT_TIMESTAMP)`;
  db.run(sql, [guildId, webhookUrl], function(err) {
    if (err) {
      console.error('Insert error', err.message);
      db.close();
      process.exit(3);
    }
    console.log('Inserted rows:', this.changes);

    db.all('SELECT id, guild_id, config_key, value, updated_at FROM guild_config WHERE guild_id = ?', [guildId], (err, rows) => {
      if (err) console.error('Select error', err.message);
      console.log('Rows for guild:', rows);
      db.close();
    });
  });
});
