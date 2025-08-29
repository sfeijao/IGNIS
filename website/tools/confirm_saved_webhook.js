const Database = require('../database/database');
const config = require('../../utils/config');

(async () => {
  try {
    const guildId = config.DISCORD.GUILD_ID || process.env.GUILD_ID;
    console.log('Using guildId:', guildId);
    const db = new Database();
    await db.initialize();
    const cfg = await db.getGuildConfig(guildId, 'archive_webhook_url');
    console.log('archive_webhook_url row:', cfg);
    process.exit(0);
  } catch (err) {
    console.error('ERROR', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
