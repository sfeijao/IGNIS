const { Events } = require('discord.js');
const storage = require('../utils/storage');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild, client) {
        try {
            logger.info(`Guild joined: ${guild.name} (${guild.id}) - initializing configuration`);
            
            // Initialize guild configuration
            let config = await storage.getGuildConfig(guild.id) || {};
            config.serverName = guild.name;
            config.joinedAt = new Date().toISOString();
            config.ticketSystem = config.ticketSystem || {
                logServerId: null,
                logChannelId: null,
                deleteInsteadOfArchive: true
            };
            await storage.setGuildConfig(guild.id, config);
            
            logger.info(`✅ Configuration initialized for guild: ${guild.name} (${guild.id})`);
        } catch (error) {
            logger.error(`❌ Error initializing guild: ${error.message}`, { guildId: guild.id, guildName: guild.name });
        }
    },
};
