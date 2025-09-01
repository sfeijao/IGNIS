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
      const res = await db.addGuildWebhook(e.guildId, e.url, { name: 'seeded' });
      console.log(`addGuildWebhook result for ${e.guildId}:`, res);
    }

    db.db.all("SELECT id,guild_id,url,name,channel_id,channel_name,created_at,updated_at FROM guild_webhooks", [], (err, rows) => {
      if (err) console.error('select error', err);
      else console.log('guild_webhooks rows:', rows);
      db.close();
    });
  } catch (err) {
    console.error('error', err);
    db.close();
    process.exit(1);
  }
})();
