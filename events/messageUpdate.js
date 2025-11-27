const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        try {
            const msg = newMessage || oldMessage;
            if (!msg?.guild) return;
            const guildId = msg.guild.id;

            // Ignore bots
            if ((newMessage?.author && newMessage.author.bot) || (oldMessage?.author && oldMessage.author.bot)) return;

            // Ensure contents are available
            try { if (oldMessage && oldMessage.partial) await oldMessage.fetch(); } catch (e) { logger.debug('Caught error:', e?.message || e); }
            try { if (newMessage && newMessage.partial) await newMessage.fetch(); } catch (e) { logger.debug('Caught error:', e?.message || e); }

            const before = oldMessage?.content || '';
            const after = newMessage?.content || '';
            if (before === after) return; // no content change

            // Socket event for dashboard
            if (msg.client.socketManager) {
                msg.client.socketManager.onDiscordEvent('messageUpdate', guildId, {
                    channelId: msg.channel.id,
                    channelName: msg.channel?.name,
                    authorId: (newMessage?.author || oldMessage?.author)?.id,
                    authorName: (newMessage?.author || oldMessage?.author)?.username,
                    messageId: msg.id,
                    before,
                    after,
                    editedAt: new Date().toISOString()
                });
            }

            // Persist log
            try {
                const storage = require('../utils/storage');
                await storage.addLog({
                    guild_id: guildId,
                    type: 'mod_message_update',
                    message: 'content_changed',
                    data: {
                        channelId: msg.channel.id,
                        messageId: msg.id,
                        authorId: (newMessage?.author || oldMessage?.author)?.id,
                        before,
                        after,
                    }
                });
            } catch (e) { logger.debug('Caught error:', e?.message || e); }
        } catch (err) {
            const logger = require('../utils/logger');
            logger.warn('messageUpdate handler error:', err?.message || err);
        }
    }
};
