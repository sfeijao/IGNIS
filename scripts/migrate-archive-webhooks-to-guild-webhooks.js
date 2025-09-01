const Database = require('../website/database/database');

(async function(){
  const db = new Database();
  await db.initialize();

  console.log('Looking for legacy archive_webhook_url entries...');

  db.db.all("SELECT id,guild_id,config_key,value,updated_at FROM guild_config WHERE config_key = 'archive_webhook_url'", async (err, rows) => {
    if (err) {
      console.error('DB error:', err);
      process.exit(1);
    }

    if (!rows || rows.length === 0) {
      console.log('No legacy archive_webhook_url rows found.');
      process.exit(0);
    }

    for (const r of rows) {
      try {
        const guildId = r.guild_id;
        const url = r.value;
        if (!url) continue;

        // Check if an identical webhook already present
        const existing = await db.getGuildWebhooks(guildId);
        const exists = existing.some(e => e.url === url);
        if (exists) {
          console.log(`Guild ${guildId}: webhook already exists, skipping`);
          continue;
        }

        await db.addGuildWebhook(guildId, url, { name: 'Migrated legacy webhook' });
        console.log(`Guild ${guildId}: migrated webhook ${url}`);
      } catch (e) {
        console.error('Error migrating row', r, e && e.message ? e.message : e);
      }
    }

    console.log('Migration complete. You may optionally remove legacy guild_config entries if desired.');
    process.exit(0);
  });
})();
