const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel) {
        try {
            const storage = require('../utils/storage');
            const guildId = channel?.guild?.id; if (!guildId) return;
            const data = {
                id: channel.id,
                type: channel.type,
                name: channel.name,
                parentId: channel.parentId || null,
                topic: channel.topic || null,
                nsfw: !!channel.nsfw,
                rateLimitPerUser: channel.rateLimitPerUser || 0,
                bitrate: channel.bitrate || null,
                userLimit: channel.userLimit || null,
                rtcRegion: channel.rtcRegion || null,
                videoQualityMode: channel.videoQualityMode || null,
                // Forum/Stage specific (best-effort, ignored when unsupported)
                defaultAutoArchiveDuration: channel.defaultAutoArchiveDuration || channel.defaultThreadAutoArchiveDuration || null,
                defaultThreadRateLimitPerUser: channel.defaultThreadRateLimitPerUser || null,
                defaultSortOrder: channel.defaultSortOrder ?? null,
                defaultForumLayout: channel.defaultForumLayout ?? null,
                defaultReactionEmoji: channel.defaultReactionEmoji ? { id: channel.defaultReactionEmoji.id || null, name: channel.defaultReactionEmoji.name || null } : null,
                availableTags: Array.isArray(channel.availableTags) ? channel.availableTags.map(t => ({ id: t.id, name: t.name, moderated: !!t.moderated })) : [],
                permissionOverwrites: (channel.permissionOverwrites?.cache ? [...channel.permissionOverwrites.cache.values()].map(po => ({ id: po.id, type: po.type, allow: po.allow.bitfield?.toString() || po.allow?.toString?.() || '0', deny: po.deny.bitfield?.toString() || po.deny?.toString?.() || '0' })) : [])
            };
            await storage.addLog({ guild_id: guildId, type: 'mod_channel_create', message: channel.name, data });
        } catch (e) { logger.warn('channelCreate log failed:', e?.message||e); }
    }
};
