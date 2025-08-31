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
                                const webhookUrl = webhookConfig?.value || null;

                                logger.info('Resolved archive webhook for channelDelete', { guildId, webhookUrl, ticketId: ticket.id });

                                if (webhookUrl && !ticket?.bug_webhook_sent) {
                                    logger.info('Attempting to send archive webhook (channelDelete)', { webhookUrl, ticketId: ticket.id });
                                    const sent = await sendArchivedTicketWebhook(webhookUrl, ticket, 'Canal apagado automaticamente');
                                    if (sent) {
                                        await db.markTicketWebhookSent(ticket.id);
                                        logger.info('📤 Webhook de arquivo enviado', { webhookUrl, ticketId: ticket.id });
                                    } else {
                                        logger.warn('Archive webhook sender returned falsy (treat as failure) on channelDelete', { ticketId: ticket.id, webhookUrl });
                                        // fallback to log channel if configured
                                        try {
                                            const logCfg = guildId ? await db.getGuildConfig(guildId, 'log_channel_id') : null;
                                            const logChannelId = logCfg?.value || null;
                                            if (logChannelId && channel.guild) {
                                                const logChannel = channel.guild.channels.cache.get(logChannelId) || await client.channels.fetch(logChannelId).catch(() => null);
                                                if (logChannel && logChannel.send) {
                                                    await logChannel.send(`📦 Arquivo de ticket (fallback): Ticket ${ticket.id} - canal: <#${ticket.channel_id}>`);
                                                    logger.info('Fallback: posted archive info to log channel', { guildId, logChannelId, ticketId: ticket.id });
                                                } else {
                                                    logger.warn('Fallback log channel not found or not sendable (channelDelete)', { guildId, logChannelId });
                                                }
                                            } else {
                                                logger.debug('No log_channel_id configured for fallback (channelDelete)', { guildId });
                                            }
                                        } catch (fbErr) {
                                            logger.warn('Error during fallback posting to log channel (channelDelete)', { error: fbErr && fbErr.message ? fbErr.message : fbErr, ticketId: ticket.id });
                                        }
                                    }
                                } else {
                                    logger.debug('No archive webhook configured or already sent for this ticket (channelDelete)', { guildId, ticketId: ticket.id });
                                }
                            } catch (webErr) {
                                logger.warn('⚠️ Erro ao enviar webhook de arquivo no evento channelDelete', { error: webErr && webErr.message ? webErr.message : webErr, ticketId: ticket.id });
                                // fallback attempt
                                try {
                                    const guildId = ticket.guild_id || (channel.guild ? channel.guild.id : null);
                                    const logCfg = guildId ? await db.getGuildConfig(guildId, 'log_channel_id') : null;
                                    const logChannelId = logCfg?.value || null;
                                    if (logChannelId && channel.guild) {
                                        const logChannel = channel.guild.channels.cache.get(logChannelId) || await client.channels.fetch(logChannelId).catch(() => null);
                                        if (logChannel && logChannel.send) {
                                            await logChannel.send(`📦 Arquivo de ticket (fallback due to error): Ticket ${ticket.id} - canal: <#${ticket.channel_id}>`);
                                            logger.info('Fallback after error: posted archive info to log channel', { guildId, logChannelId, ticketId: ticket.id });
                                        } else {
                                            logger.warn('Fallback log channel not found or not sendable (after error, channelDelete)', { guildId, logChannelId });
                                        }
                                    } else {
                                        logger.debug('No log_channel_id configured for fallback (after error, channelDelete)', { guildId });
                                    }
                                } catch (fbErr) {
                                    logger.error('Error during fallback posting to log channel (after webhook error, channelDelete)', { error: fbErr && fbErr.message ? fbErr.message : fbErr, ticketId: ticket.id });
                                }
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
