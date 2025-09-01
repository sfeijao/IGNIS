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
                            
                            // Enviar webhooks de arquivo (suporta múltiplos) se configurados e ainda nao enviados
                            try {
                                const guildId = ticket.guild_id || (channel.guild ? channel.guild.id : null);
                                const webhooks = guildId ? await db.getGuildWebhooks(guildId) : [];

                                logger.info('Resolved archive webhooks for channelDelete', { guildId, webhooksCount: Array.isArray(webhooks) ? webhooks.length : 0, ticketId: ticket.id });

                                if (webhooks && webhooks.length > 0 && !ticket?.bug_webhook_sent) {
                                    // fetch ticket messages for transcript/excerpt
                                    let messages = [];
                                    try {
                                        messages = await db.db ? await new Promise((res, rej) => {
                                            db.db.all('SELECT tm.user_id, u.username, tm.message, tm.created_at FROM ticket_messages tm LEFT JOIN users u ON tm.user_id = u.discord_id WHERE tm.ticket_id = ? ORDER BY tm.id ASC', [ticket.id], (err, rows) => {
                                                if (err) return rej(err);
                                                res(rows || []);
                                            });
                                        }) : [];
                                    } catch (msgErr) {
                                        logger.warn('Failed to fetch ticket messages for channelDelete webhook excerpt', { error: msgErr && msgErr.message ? msgErr.message : msgErr, ticketId: ticket.id });
                                        messages = [];
                                    }

                                    const base = process.env.WEBSITE_BASE_URL || null;
                                    const transcriptUrl = base ? `${base.replace(/\/$/, '')}/transcript/${ticket.id}` : null;

                                    let anySent = false;
                                    for (const wh of webhooks) {
                                        try {
                                            logger.info('Attempting to send archive webhook (channelDelete)', { webhookId: wh.id, webhookUrl: wh.url, ticketId: ticket.id });
                                            const payloadTicket = Object.assign({}, ticket, { messages, transcriptUrl });
                                            const sent = await sendArchivedTicketWebhook(wh.url, payloadTicket, 'Canal apagado automaticamente');
                                            if (sent) {
                                                anySent = true;
                                                logger.info('📤 Webhook de arquivo enviado', { webhookId: wh.id, ticketId: ticket.id });
                                                try { await db.createLog(ticket.guild_id, 'webhook_sent', { ticketId: ticket.id, webhookId: wh.id, webhookUrl: wh.url }); } catch(_){}
                                            } else {
                                                logger.warn('Archive webhook sender returned falsy for webhook id (channelDelete)', { webhookId: wh.id, ticketId: ticket.id });
                                                try { await db.createLog(ticket.guild_id, 'webhook_failed', { ticketId: ticket.id, webhookId: wh.id, webhookUrl: wh.url }); } catch(_){}
                                            }
                                        } catch (e) {
                                            logger.warn('Falha ao enviar webhook específico durante channelDelete', { webhookId: wh.id, error: e && e.message ? e.message : e });
                                        }
                                    }

                                    if (anySent) {
                                        await db.markTicketWebhookSent(ticket.id);
                                        logger.info('Marked ticket as webhook-sent because at least one webhook succeeded (channelDelete)', { ticketId: ticket.id });
                                    } else {
                                        // fallback to log channel
                                        try {
                                            const logCfg = guildId ? await db.getGuildConfig(guildId, 'log_channel_id') : null;
                                            const logChannelId = logCfg?.value || null;
                                                    if (logChannelId && channel.guild) {
                                                const logChannel = channel.guild.channels.cache.get(logChannelId) || await client.channels.fetch(logChannelId).catch(() => null);
                                                if (logChannel && logChannel.send) {
                                                    const forbiddenNames = ['ticket-log','tickets-log','ticket-logs','tickets_log','logs-tickets'];
                                                    const chName = (logChannel.name || '').toLowerCase();
                                                    const isForbidden = forbiddenNames.includes(chName) || forbiddenNames.some(n => chName.includes(n));
                                                    if (isForbidden) {
                                                        logger.info('Skipping fallback post to log channel due to channel name blacklist', { guildId, logChannelId, channelName: logChannel.name, ticketId: ticket.id });
                                                    } else {
                                                        await logChannel.send(`📦 Arquivo de ticket (fallback): Ticket ${ticket.id} - canal: <#${ticket.channel_id}>`);
                                                        logger.info('Fallback: posted archive info to log channel', { guildId, logChannelId, ticketId: ticket.id });
                                                        try { await db.createLog(guildId, 'webhook_fallback_logchannel', { ticketId: ticket.id, logChannelId }); } catch(_){ }
                                                    }
                                                } else {
                                                    logger.warn('Fallback log channel not found or not sendable (channelDelete)', { guildId, logChannelId });
                                                }
                                            } else {
                                                logger.debug('No log_channel_id configured for fallback (channelDelete)', { guildId });
                                            }
                                        } catch (fbErr) {
                                            logger.warn('Error during fallback posting to log channel (channelDelete)', { error: fbErr && fbErr.message ? fbErr.message : fbErr, ticketId: ticket.id });
                                        }
                                        // Also attempt to send archive payload to a private endpoint if configured
                                        try {
                                            const privateEndpoint = process.env.PRIVATE_LOG_ENDPOINT || null;
                                            const privateToken = process.env.PRIVATE_LOG_TOKEN || null;
                                            if (privateEndpoint) {
                                                const { sendToPrivateEndpoint } = require('../website/utils/privateLogger');
                                                const payload = { ticket, messages, transcriptUrl, event: 'ticket_archived', reason: 'channel_deleted' };
                                                const ok = await sendToPrivateEndpoint(privateEndpoint, privateToken, payload).catch(() => false);
                                                if (ok) await db.createLog(ticket.guild_id, 'private_log_sent', { ticketId: ticket.id });
                                                else await db.createLog(ticket.guild_id, 'private_log_failed', { ticketId: ticket.id });
                                            }
                                        } catch (privateErr) {
                                            logger.warn('Error sending to private endpoint (channelDelete)', { error: privateErr && privateErr.message ? privateErr.message : privateErr, ticketId: ticket.id });
                                        }
                                    }
                                } else {
                                    logger.debug('No archive webhooks configured or already sent for this ticket (channelDelete)', { guildId, ticketId: ticket.id });
                                }
                            } catch (webErr) {
                                logger.warn('⚠️ Erro ao enviar webhooks de arquivo no evento channelDelete', { error: webErr && webErr.message ? webErr.message : webErr, ticketId: ticket.id });
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
