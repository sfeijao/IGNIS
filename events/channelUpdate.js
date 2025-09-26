const { Events } = require('discord.js');

function snap(ch){
    return {
        id: ch.id,
        type: ch.type,
        name: ch.name,
        parentId: ch.parentId || null,
        topic: ch.topic || null,
        nsfw: !!ch.nsfw,
        rateLimitPerUser: ch.rateLimitPerUser || 0,
        bitrate: ch.bitrate || null,
        userLimit: ch.userLimit || null,
        permissionOverwrites: (ch.permissionOverwrites?.cache ? [...ch.permissionOverwrites.cache.values()].map(po => ({ id: po.id, type: po.type, allow: po.allow.bitfield?.toString() || po.allow?.toString?.() || '0', deny: po.deny.bitfield?.toString() || po.deny?.toString?.() || '0' })) : [])
    };
}

module.exports = {
    name: Events.ChannelUpdate,
    async execute(oldCh, newCh) {
        try {
            const storage = require('../utils/storage');
            const guildId = newCh?.guild?.id || oldCh?.guild?.id; if (!guildId) return;
            const before = snap(oldCh);
            const after = snap(newCh);
            if (JSON.stringify(before) === JSON.stringify(after)) return;
            await storage.addLog({ guild_id: guildId, type: 'mod_channel_update', message: newCh.name, data: { before, after } });
        } catch (e) { try { require('../utils/logger').warn('channelUpdate log failed:', e?.message||e); } catch {} }
    }
};
