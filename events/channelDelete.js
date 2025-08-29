const { Events } = require('discord.js');
const Database = require('../website/database/database');
const logger = require('../utils/logger');
const { sendArchivedTicketWebhook } = require('../website/utils/webhookSender');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel, client) {
        try {
            // Verificar se é um canal de ticket
            if (channel.type === 0 && channel.parentId) { // GuildText channel com categoria
                const category = channel.parent;

                // Verificar se é da categoria de tickets: preferir config com ID
                let isTicketCategory = false;
                try {
                    const db = new Database();
                    await db.initialize();
                    const cfg = await db.getGuildConfig(channel.guild.id, 'ticket_category_id');
                    if (cfg?.value && category && category.id === cfg.value) isTicketCategory = true;
                } catch (e) {
                    // fallback
                }

                if (!isTicketCategory && category && category.name === '📁 TICKETS') {
                    isTicketCategory = true;
                }

                if (isTicketCategory) {
                    logger.info(`🗑️ Canal de ticket apagado: ${channel.name} (${channel.id})`, { channelId: channel.id, channelName: channel.name });
                    
                    // Atualizar status do ticket na base de dados
                    try {
                        const db = new Database();
                        await db.initialize();
                        
                        // Buscar ticket pela channel_id
                        const ticket = await db.getTicketByChannelId(channel.id);
                        
                        if (ticket) {
                            // Marcar como fechado/arquivado
                            await db.updateTicketStatus(ticket.id, 'archived', null, 'Canal apagado automaticamente');
                            logger.info(`✅ Ticket ${ticket.id} marcado como arquivado na base de dados`, { ticketId: ticket.id });
                            
                            // Enviar webhook de arquivo se configurado e ainda nao enviado
                            try {
                                const guildId = ticket.guild_id || (channel.guild ? channel.guild.id : null);
                                const webhookConfig = guildId ? await db.getGuildConfig(guildId, 'archive_webhook_url') : null;
                                if (webhookConfig?.value && !ticket?.bug_webhook_sent) {
                                    const sent = await sendArchivedTicketWebhook(webhookConfig.value, ticket, 'Canal apagado automaticamente');
                                    if (sent) {
                                        await db.markTicketWebhookSent(ticket.id);
                                        logger.info('📤 Webhook de arquivo enviado para %s (ticket %s)', webhookConfig.value, ticket.id);
                                    }
                                }
                            } catch (webErr) {
                                logger.warn('⚠️ Erro ao enviar webhook de arquivo no evento channelDelete', { error: webErr && webErr.message ? webErr.message : webErr, ticketId: ticket.id });
                            }

                            // Notificar dashboard via Socket.IO
                            if (global.socketManager) {
                                global.socketManager.broadcast('ticket_deleted', {
                                    id: ticket.id,
                                    channelId: channel.id,
                                    channelName: channel.name,
                                    guildId: channel.guild.id,
                                    timestamp: new Date().toISOString()
                                });
                logger.info('📡 Socket.IO: Ticket deletion enviado para dashboard', { ticketId: ticket.id });
                            }
                        }
                        
                    } catch (dbError) {
            logger.error('❌ Erro ao atualizar ticket na base de dados:', { error: dbError.message || dbError });
                    }
                }
            }
            
        } catch (error) {
        logger.error('❌ Erro no evento channelDelete:', { error: error.message || error });
        }
    }
};
