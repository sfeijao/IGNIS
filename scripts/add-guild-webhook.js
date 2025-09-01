const Database = require('../website/database/database');

async function usage() {
  console.log('Usage: node scripts/add-guild-webhook.js <guildId> <webhookUrl> [channelId] [name]');
  console.log('Example: node scripts/add-guild-webhook.js 1408278468822565075 https://discord.com/api/webhooks/... 123456789012345678 "Archive webhook"');
}

(async function(){
  const args = process.argv.slice(2);
  if (args.length < 2) {
    await usage();
    process.exit(0);
  }
  const [guildId, webhookUrl, channelId, ...nameParts] = args;
  const name = nameParts.length ? nameParts.join(' ') : null;

  // basic validation
  if (!/^\d+$/.test(guildId)) {
    console.error('guildId should be numeric');
    process.exit(2);
  }
  if (!/^https:\/\/discord(?:app)?\.com\/api\/webhooks\/.+/.test(webhookUrl)) {
    console.error('webhookUrl does not look like a discord webhook URL');
    process.exit(2);
  }

  const db = new Database();
  await db.initialize();
  try {
    const res = await db.addGuildWebhook(guildId, webhookUrl, { channel_id: channelId || null, name });
    console.log('Inserted webhook row:', res);
  } catch (e) {
    console.error('Error inserting webhook:', e && e.message ? e.message : e);
    process.exit(3);
  } finally {
    db.close();
  }
})();
