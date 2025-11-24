const inviteTrackerService = require('../src/services/inviteTrackerService');
const logger = require('../utils/logger');

module.exports = {
    name: 'inviteDelete',
    async execute(invite) {
        try {
            const guild = invite.guild;
            if (!guild) return;

            logger.info(`[InviteDelete] Invite deleted: ${invite.code} in ${guild.name}`);

            // Sincronizar convites do servidor (marca como inativo)
            await inviteTrackerService.syncGuildInvites(guild);
        } catch (error) {
            logger.error('[InviteDelete] Error handling invite delete:', error);
        }
    }
};
