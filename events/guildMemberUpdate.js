const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        try {
            if (!newMember?.guild) return;
            const guildId = newMember.guild.id;

            const changes = {};
            if ((oldMember?.nickname || null) !== (newMember?.nickname || null)) {
                changes.nickname = { before: oldMember?.nickname || null, after: newMember?.nickname || null };
            }
            const oldRoles = new Set((oldMember?.roles?.cache?.keys && [...oldMember.roles.cache.keys()]) || []);
            const newRoles = new Set((newMember?.roles?.cache?.keys && [...newMember.roles.cache.keys()]) || []);
            const added = [...newRoles].filter(r => !oldRoles.has(r));
            const removed = [...oldRoles].filter(r => !newRoles.has(r));
            if (added.length || removed.length) changes.roles = { added, removed };

            if (!Object.keys(changes).length) return;

            if (newMember.client.socketManager) {
                newMember.client.socketManager.onDiscordEvent('guildMemberUpdate', guildId, {
                    userId: newMember.id,
                    username: newMember.user?.username,
                    changes,
                    timestamp: new Date().toISOString()
                });
            }

            try {
                const storage = require('../utils/storage');
                await storage.addLog({ guild_id: guildId, type: 'mod_member_update', message: 'member_updated', data: { userId: newMember.id, ...changes } });
            } catch (e) { logger.debug('Caught error:', e?.message || e); }
        } catch (err) {
            const logger = require('../utils/logger');
            logger.warn('guildMemberUpdate handler error:', err?.message || err);
        }
    }
};
