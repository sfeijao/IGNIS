const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageBulkDelete,
    async execute(messages) {
        try {
            if (!messages || messages.size === 0) return;
            const sample = messages.first();
            if (!sample?.guild) return;
            const guildId = sample.guild.id;
            const channel = sample.channel;

            // Attempt to attribute via audit log (best-effort; may need intents/permissions)
            let executorId = null;
            try {
                const fetched = await sample.guild.fetchAuditLogs({ type: 72 /* MESSAGE_BULK_DELETE */ , limit: 1 });
                const entry = fetched.entries.first();
                if (entry && entry.createdTimestamp > Date.now() - 15_000) {
                    executorId = entry.executor?.id || null;
                }
            } catch (e) { logger.debug('Caught error:', e?.message || e); }

            if (sample.client.socketManager) {
                sample.client.socketManager.onDiscordEvent('messageBulkDelete', guildId, {
                    channelId: channel.id,
                    channelName: channel?.name,
                    count: messages.size,
                    executorId,
                    timestamp: new Date().toISOString()
                });
            }

            try {
                const storage = require('../utils/storage');
                await storage.addLog({
                    guild_id: guildId,
                    type: 'mod_message_bulk_delete',
                    message: `${messages.size}`,
                    data: { channelId: channel.id, executorId }
                });
            } catch (e) { logger.debug('Caught error:', e?.message || e); }
        } catch (err) {
            const logger = require('../utils/logger');
            logger.warn('messageBulkDelete handler error:', err?.message || err);
        }
    }
};
