const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildBanAdd,
    async execute(ban) {
        try {
            if (!ban?.guild) return;
            const guild = ban.guild;
            const user = ban.user;
            let executorId = null;
            let reason = null;
            try {
                const fetched = await guild.fetchAuditLogs({ type: 22 /* MEMBER_BAN_ADD */, limit: 1 });
                const entry = fetched.entries.first();
                if (entry && entry.target?.id === user.id && entry.createdTimestamp > Date.now() - 15_000) {
                    executorId = entry.executor?.id || null;
                    reason = entry.reason || null;
                }
            } catch (e) { logger.debug('Caught error:', e?.message || e); }

            if (guild.client.socketManager) {
                guild.client.socketManager.onDiscordEvent('guildBanAdd', guild.id, {
                    userId: user.id,
                    username: user.username,
                    executorId,
                    reason,
                    timestamp: new Date().toISOString()
                });
            }

            try {
                const storage = require('../utils/storage');
                await storage.addLog({ guild_id: guild.id, type: 'mod_ban_add', message: reason || '', data: { userId: user.id, executorId } });
            } catch (e) { logger.debug('Caught error:', e?.message || e); }
        } catch (err) {
            const logger = require('../utils/logger');
            logger.warn('guildBanAdd handler error:', err?.message || err);
        }
    }
};
