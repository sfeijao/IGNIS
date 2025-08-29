const { Events } = require('discord.js');
const { scanGuildAndSave } = require('../website/tools/auto_config');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild, client) {
        try {
            logger.info(`Guild joined: ${guild.id} - starting auto-scan`);
            await scanGuildAndSave(guild, client);
        } catch (err) {
            logger.warn('Error during guildCreate auto-scan', { error: err && err.message ? err.message : err });
        }
    }
};
