const { Events } = require('discord.js');
const storage = require('../utils/storage');
const logger = require('../utils/logger');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel, client) {
        try {
            // Verificar se é um canal de ticket
            if (channel.type === 0 && channel.parentId) { // GuildText channel com categoria
                const category = channel.parent;

                // Verificar se é da categoria de tickets
                let isTicketCategory = false;
                const config = await storage.getGuildConfig(channel.guild.id);
                
                if (config.ticketSystem?.categoryId && category && category.id === config.ticketSystem.categoryId) {
                    isTicketCategory = true;
                } else if (category && category.name === '📁 TICKETS') {
                    isTicketCategory = true;
                }

                if (isTicketCategory) {
                    logger.info(`🗑️ Canal de ticket apagado: ${channel.name} (${channel.id})`, { channelId: channel.id, channelName: channel.name });
                    
                    // Buscar e atualizar ticket no storage
                    try {
                        const ticket = await storage.getTicketByChannel(channel.id);
                        
                        if (ticket) {
                            // Marcar como fechado/arquivado
                            ticket.status = 'archived';
                            ticket.closedBy = 'Sistema';
                            ticket.closedAt = new Date().toISOString();
                            ticket.closeReason = 'Canal apagado automaticamente';
                            
                            await storage.updateTicket(ticket.id, ticket);
                            logger.info(`✅ Ticket ${ticket.id} marcado como arquivado no storage`, { ticketId: ticket.id });
                            
                            // Log da ação
                            await storage.addLog(channel.guild.id, {
                                type: 'TICKET_DELETED',
                                ticketId: ticket.id,
                                channelId: channel.id,
                                channelName: channel.name,
                                user: 'Sistema',
                                timestamp: new Date().toISOString(),
                                details: 'Canal de ticket apagado automaticamente'
                            });
                        }
                    } catch (error) {
                        logger.error('❌ Erro ao processar ticket apagado:', { error, channelId: channel.id });
                    }
                }
            }
        } catch (error) {
            logger.error('❌ Erro no evento channelDelete:', { error, channelId: channel?.id });
        }
    },
};
