const { Events, PermissionsBitField } = require('discord.js');

function snap(r){
    return {
        id: r.id,
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        position: r.position,
        mentionable: r.mentionable,
        permissions: (r.permissions instanceof PermissionsBitField ? r.permissions.bitfield.toString() : (r.permissions?.toString?.()||'0'))
    };
}

module.exports = {
    name: Events.GuildRoleDelete,
    async execute(role) {
        try {
            const storage = require('../utils/storage');
            const guildId = role?.guild?.id; if (!guildId) return;
            let members = [];
            try {
                if (role && role.members && role.members.size >= 0) {
                    members = [...role.members.keys()];
                }
            } catch (e) { logger.debug('Caught error:', e?.message || e); }
            await storage.addLog({ guild_id: guildId, type: 'mod_role_delete', message: role.name, data: { ...snap(role), members } });
        } catch (e) { try { require('../utils/logger').warn('roleDelete log failed:', e?.message||e); } catch (e) { logger.debug('Caught error:', e?.message || e); } }
    }
};
