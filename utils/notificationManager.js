const logger = require('./logger');

class NotificationManager {
    constructor(client) {
        this.client = client;
    }

    async notifyStaff(guild, ticket, type = 'create') {
        try {
            const guildConfig = await this.client.storage.getGuildConfig(guild.id);
            if (!guildConfig?.ticketStaffRoleId) {
                return logger.warn('Cargo de staff não configurado para notificações', { guildId: guild.id });
            }

            // Obter canal de notificação
            const notificationChannelId = guildConfig.ticketNotificationChannelId;
            if (!notificationChannelId) {
                return logger.warn('Canal de notificações não configurado', { guildId: guild.id });
            }

            const channel = await guild.channels.fetch(notificationChannelId);
            if (!channel) {
                return logger.warn('Canal de notificações não encontrado', { guildId: guild.id });
            }

            // Preparar mensagem baseada no tipo
            let content = '';
            switch (type) {
                case 'create':
                    content = `<@&${guildConfig.ticketStaffRoleId}> 🎫 **Novo ticket criado!**\n`
                        + `Canal: <#${ticket.channel_id}>\n`
                        + `Usuário: <@${ticket.user_id}>\n`
                        + `Prioridade: ${this.getPriorityEmoji(ticket.priority)} ${ticket.priority}\n`
                        + `Assunto: ${ticket.subject}`;
                    break;
                case 'inactive':
                    content = `<@&${guildConfig.ticketStaffRoleId}> ⚠️ **Ticket inativo!**\n`
                        + `Canal: <#${ticket.channel_id}>\n`
                        + `Última atividade: <t:${Math.floor(new Date(ticket.last_activity).getTime()/1000)}:R>`;
                    break;
                // Adicionar outros tipos conforme necessário
            }

            // Enviar notificação
            await channel.send({
                content,
                allowedMentions: {
                    roles: [guildConfig.ticketStaffRoleId]
                }
            });

        } catch (error) {
            logger.error('Erro ao enviar notificação para staff', {
                guildId: guild.id,
                ticketId: ticket.id,
                error: error.message
            });
        }
    }

    getPriorityEmoji(priority) {
        const emojis = {
            'low': '🟢',
            'normal': '🟡',
            'high': '🟠',
            'urgent': '🔴'
        };
        return emojis[priority] || '⚪';
    }
}

module.exports = NotificationManager;
