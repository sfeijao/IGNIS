const { Events } = require('discord.js');
const logger = require('../utils/logger');

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
        rtcRegion: ch.rtcRegion || null,
        videoQualityMode: ch.videoQualityMode || null,
        defaultAutoArchiveDuration: ch.defaultAutoArchiveDuration || ch.defaultThreadAutoArchiveDuration || null,
        defaultThreadRateLimitPerUser: ch.defaultThreadRateLimitPerUser || null,
        defaultSortOrder: ch.defaultSortOrder ?? null,
        defaultForumLayout: ch.defaultForumLayout ?? null,
        defaultReactionEmoji: ch.defaultReactionEmoji ? { id: ch.defaultReactionEmoji.id || null, name: ch.defaultReactionEmoji.name || null } : null,
        availableTags: Array.isArray(ch.availableTags) ? ch.availableTags.map(t => ({ id: t.id, name: t.name, moderated: !!t.moderated })) : [],
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
        } catch (e) { logger.warn('channelUpdate log failed:', e?.message||e); }
    }
};
