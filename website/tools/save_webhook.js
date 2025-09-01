const Database = require('../database/database');
const config = require('../../utils/config');

(async () => {
  try {
    const webhookUrl = 'https://discord.com/api/webhooks/1409372170743972091/MZ6aCMlvH4iCFP_9DiUloLYkY_TPXPwiWP1XUu5_IOcq8HLk3OHhYizE4eBxMxrIEtjq';

    const guildId = config.DISCORD.GUILD_ID || process.env.GUILD_ID;
    if (!guildId) {
      console.error('Nenhum guildId disponível (config.DISCORD.GUILD_ID não encontrado).');
      process.exit(1);
    }

    const db = new Database();
    await db.initialize();
  await db.addGuildWebhook(guildId, webhookUrl, { name: 'Saved via tool' });

  console.log(`✅ Webhook ADICIONADO para guild ${guildId}`);
    process.exit(0);
  } catch (err) {
    console.error('Erro ao salvar webhook:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
