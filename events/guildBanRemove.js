const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildBanRemove,
    async execute(ban) {
        try {
            if (!ban?.guild) return;
            const guild = ban.guild;
            const user = ban.user;
            let executorId = null;
            try {
                const fetched = await guild.fetchAuditLogs({ type: 23 /* MEMBER_BAN_REMOVE */, limit: 1 });
                const entry = fetched.entries.first();
                if (entry && entry.target?.id === user.id && entry.createdTimestamp > Date.now() - 15_000) {
                    executorId = entry.executor?.id || null;
                }
            } catch {}

            if (guild.client.socketManager) {
                guild.client.socketManager.onDiscordEvent('guildBanRemove', guild.id, {
                    userId: user.id,
                    username: user.username,
                    executorId,
                    timestamp: new Date().toISOString()
                });
            }

            try {
                const storage = require('../utils/storage');
                await storage.addLog({ guild_id: guild.id, type: 'mod_ban_remove', message: '', data: { userId: user.id, executorId } });
            } catch {}
        } catch (err) {
            const logger = require('../utils/logger');
            logger.warn('guildBanRemove handler error:', err?.message || err);
        }
    }
};
