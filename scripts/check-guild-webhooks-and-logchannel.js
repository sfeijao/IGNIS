const Database = require('../website/database/database');

(async function(){
  const db = new Database();
  await db.initialize();
  const guildId = process.argv[2] || '1408278468822565075';
  console.log('Checking guild:', guildId);
  try {
    const webhooks = await db.getGuildWebhooks(guildId);
    console.log('webhooks:', webhooks);
  } catch(e){ console.error('error listing webhooks', e); }
  try {
    const cfg = await db.getGuildConfig(guildId, 'log_channel_id');
    console.log('log_channel_id config:', cfg);
  } catch(e){ console.error('error getting log_channel_id config', e); }
  process.exit(0);
})();
