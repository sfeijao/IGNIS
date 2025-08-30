const Database = require('../website/database/database');

(async () => {
  const db = new Database();
  try {
    await db.initialize();

    const entries = [
      { guildId: '1333820000791691284', url: 'https://discord.com/api/webhooks/1409372170743972091/MZ6aCMlvH4iCFP_9DiUloLYkY_TPXPwiWP1XUu5_IOcq8HLk3OHhYizE4eBxMxrIEtjq' },
      { guildId: '1283603691538088027', url: 'https://discord.com/api/webhooks/1411464971388321792/_0BSDYEfcKCNrrhJ67YseUOd1NZwIKZGble5SUCNJOxXC3KlPhcBqVCrnpKx6cCBoNMw' }
    ];

    for (const e of entries) {
      const res = await db.setGuildConfig(e.guildId, 'archive_webhook_url', e.url);
      console.log(`setGuildConfig result for ${e.guildId}:`, res);
    }

    db.db.all("SELECT id,guild_id,config_key,value,updated_at FROM guild_config WHERE config_key = 'archive_webhook_url'", [], (err, rows) => {
      if (err) console.error('select error', err);
      else console.log('archive_webhook_url rows:', rows);
      db.close();
    });
  } catch (err) {
    console.error('error', err);
    db.close();
    process.exit(1);
  }
})();
