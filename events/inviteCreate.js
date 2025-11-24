const inviteTrackerService = require('../src/services/inviteTrackerService');
const logger = require('../utils/logger');

module.exports = {
    name: 'inviteCreate',
    async execute(invite) {
        try {
            const guild = invite.guild;
            if (!guild) return;

            logger.info(`[InviteCreate] New invite created: ${invite.code} in ${guild.name}`);

            // Sincronizar convites do servidor
            await inviteTrackerService.syncGuildInvites(guild);
        } catch (error) {
            logger.error('[InviteCreate] Error handling invite create:', error);
        }
    }
};
