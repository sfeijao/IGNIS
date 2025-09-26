const { Events } = require('discord.js');
const storage = require('../utils/storage');
const logger = require('../utils/logger');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel, client) {
        try {
            // Persist structural log for later revert
            try {
                const storage = require('../utils/storage');
                const guildId = channel?.guild?.id; if (guildId) {
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
                        permissionOverwrites: (channel.permissionOverwrites?.cache ? [...channel.permissionOverwrites.cache.values()].map(po => ({ id: po.id, type: po.type, allow: po.allow.bitfield?.toString() || po.allow?.toString?.() || '0', deny: po.deny.bitfield?.toString() || po.deny?.toString?.() || '0' })) : [])
                    };
                    await storage.addLog({ guild_id: guildId, type: 'mod_channel_delete', message: channel.name, data });
                }
            } catch {}
            // Log detalhado para debug
            logger.debug('🔍 Channel deletado:', {
                channelId: channel.id,
                channelName: channel.name,
                channelType: channel.type,
                parentId: channel.parentId,
                guildId: channel.guild.id
            });

            // Verificar se é um canal de ticket
            if (channel.type === 0 && channel.parentId) { // GuildText channel com categoria
                const category = channel.parent;

                // Verificar se é da categoria de tickets
                let isTicketCategory = false;
                const config = await storage.getGuildConfig(channel.guild.id);
                
                logger.debug('🔧 Verificando categoria:', {
                    categoryId: category?.id,
                    categoryName: category?.name,
                    configCategoryId: config?.ticketSystem?.categoryId
                });
                
                if (config?.ticketSystem?.categoryId && category && category.id === config.ticketSystem.categoryId) {
                    isTicketCategory = true;
                    logger.debug('✅ Canal identificado como ticket (por config)');
                } else if (category && (category.name === '📁 TICKETS' || category.name.includes('TICKETS'))) {
                    isTicketCategory = true;
                    logger.debug('✅ Canal identificado como ticket (por nome da categoria)');
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
                        logger.error('❌ Erro ao processar ticket apagado:', { 
                            error: error.message || error, 
                            stack: error.stack,
                            channelId: channel.id,
                            channelName: channel.name,
                            guildId: channel.guild.id
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('❌ Erro no evento channelDelete:', { 
                error: error.message || error, 
                stack: error.stack,
                channelId: channel?.id,
                channelName: channel?.name,
                channelType: channel?.type,
                guildId: channel?.guild?.id
            });
        }
    },
};
