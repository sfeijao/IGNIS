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
    name: Events.GuildRoleUpdate,
    async execute(oldRole, newRole) {
        try {
            const storage = require('../utils/storage');
            const guildId = newRole?.guild?.id || oldRole?.guild?.id; if (!guildId) return;
            const before = snap(oldRole); const after = snap(newRole);
            if (JSON.stringify(before) === JSON.stringify(after)) return;
            await storage.addLog({ guild_id: guildId, type: 'mod_role_update', message: newRole.name, data: { before, after } });
        } catch (e) { try { require('../utils/logger').warn('roleUpdate log failed:', e?.message||e); } catch {} }
    }
};
