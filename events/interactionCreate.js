const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, MessageFlags, WebhookClient } = require('discord.js');
const errorHandler = require('../utils/errorHandler');
const logger = require('../utils/logger');
const config = require('../utils/config');
const { BUTTON_IDS, MODAL_IDS, INPUT_IDS, EMBED_COLORS, EMOJIS, ERROR_MESSAGES } = require('../constants/ui');
const { getTicketTypeInfo } = require('../utils/ticketModals');

// Função auxiliar para obter ou criar categoria de tickets
async function getOrCreateTicketCategory(guild) {
    let ticketCategory = guild.channels.cache.find(c => c.name === '📁 TICKETS' && c.type === ChannelType.GuildCategory);
    
    if (!ticketCategory) {
        logger.debug(`Categoria '📁 TICKETS' não encontrada, criando automaticamente...`);
        try {
            ticketCategory = await guild.channels.create({
                name: '📁 TICKETS',
                type: ChannelType.GuildCategory,
                reason: 'Categoria criada automaticamente para sistema de tickets'
            });
            logger.info(`Categoria criada com sucesso: ${ticketCategory.name}`);
        } catch (error) {
            logger.error(`Erro ao criar categoria:`, { error: error.message || error });
            throw new Error('FAILED_TO_CREATE_TICKET_CATEGORY');
        }
    }
    
    return ticketCategory;
}

// Função para enviar ticket via webhook
async function sendTicketWebhook(ticketData) {
    try {
        // Verificar se há webhook de tickets configurado
        const webhookUrl = config.WEBHOOKS.TICKETS;
        if (!webhookUrl) {
            logger.debug('Webhook de tickets não configurado');
             return;
         }

        const webhook = new WebhookClient({ url: webhookUrl });
        
        const embed = new EmbedBuilder()
            .setTitle('🎫 Novo Ticket Criado')
            .setDescription(`Um novo ticket foi criado no servidor **${ticketData.guildName}**`)
            .addFields(
                { name: '👤 Utilizador', value: ticketData.userName, inline: true },
                { name: '📂 Tipo', value: ticketData.ticketType || 'Geral', inline: true },
                { name: '🆔 Canal', value: `<#${ticketData.channelId}>`, inline: true },
                { name: '🏷️ Nome do Canal', value: ticketData.channelName, inline: true },
                { name: '🕐 Criado', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setColor(EMBED_COLORS.PRIMARY)
            .setTimestamp()
            .setFooter({ text: `Servidor: ${ticketData.guildName}` });

        await webhook.send({ embeds: [embed] });
        logger.info('Ticket enviado via webhook com sucesso', { guild: ticketData.guildId, channelId: ticketData.channelId });
         
     } catch (error) {
        logger.error('Erro ao enviar ticket via webhook:', { error: error.message || error });
    }
}

// Cache para prevenir duplicação de tickets
const ticketCreationCache = new Map();

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        logger.debug(`interactionCreate chamado - client exists: ${!!client}, commands exists: ${!!client?.commands}`);
        
        // Verificar se a interação ainda é válida (não expirou)
        const now = Date.now();
        const interactionTime = new Date(interaction.createdTimestamp).getTime();
        const timeDiff = now - interactionTime;
        
        if (timeDiff > 2000) { // Se passou mais de 2 segundos
            logger.debug(`Interação potencialmente expirada (${timeDiff}ms), processando com cuidado`);
        }
        
        try {
            // Comando Slash
            if (interaction.isChatInputCommand()) {
                // Verificar se client.commands existe
                if (!client.commands) {
                    logger.error('client.commands não inicializado', {
                        userId: interaction.user.id,
                        guildId: interaction.guild?.id
                    });
                    return interaction.reply({
                        content: ERROR_MESSAGES.SYSTEM_ERROR,
                        flags: MessageFlags.Ephemeral
                    });
                }

                const command = client.commands.get(interaction.commandName);
                if (!command) {
                    logger.warn(`Comando não encontrado: ${interaction.commandName}`, {
                        userId: interaction.user.id,
                        guildId: interaction.guild?.id
                    });
                    return;
                }

                try {
                    // Log comando sendo executado
                    logger.command(interaction.commandName, interaction, true);
                    
                    await command.execute(interaction, client);
                } catch (error) {
                    // Usar error handler centralizado
                    await errorHandler.handleInteractionError(interaction, error, 'Comando');
                    
                    // Log estruturado do erro
                    logger.command(interaction.commandName, interaction, false);
                }
                return;
            }

            // Botões
            if (interaction.isButton()) {
                const customId = interaction.customId;
                
                // Se for botão de ticket, ignorar aqui (será processado pelo ticketInteractions.js)
                if (customId?.startsWith('ticket_')) {
                    return;
                }
                
                logger.debug(`Botão pressionado - ID: "${customId}" por ${interaction.user.tag}`);
                logger.debug(`IDs disponíveis - CLOSE_TICKET: "${BUTTON_IDS.CLOSE_TICKET}", CONFIRM_CLOSE: "${BUTTON_IDS.CONFIRM_CLOSE}"`);

                // Sistema de Verificação
                if (customId === BUTTON_IDS.VERIFY_USER) {
                    try {
                        logger.interaction('button', customId, interaction, true);
                        
                        // Prefer role ID from guild config, fallback to role name
                        let verifyRole = null;
                        try {
                            const db = new Database();
                            await db.initialize();
                            const cfg = await db.getGuildConfig(interaction.guild.id, 'verify_role_id');
                            if (cfg?.value) verifyRole = interaction.guild.roles.cache.get(cfg.value) || null;
                        } catch (e) {
                            // ignore and fallback
                        }
                        if (!verifyRole) verifyRole = interaction.guild.roles.cache.find(role => role.name === 'Verificado');
                        if (!verifyRole) {
                            await errorHandler.handleInteractionError(interaction, new Error('VERIFY_ROLE_NOT_FOUND'));
                            return;
                        }

                        if (interaction.member.roles.cache.has(verifyRole.id)) {
                            return await interaction.reply({
                                content: `${EMOJIS.SUCCESS} Já estás verificado!`,
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        await interaction.member.roles.add(verifyRole);
                        await interaction.reply({
                            content: `${EMOJIS.SUCCESS} Verificação completa! Bem-vindo(a) ao servidor!`,
                            flags: MessageFlags.Ephemeral
                        });

                        // Log da verificação com sistema estruturado
                        logger.database('verification', {
                            userId: interaction.user.id,
                            guildId: interaction.guild.id,
                            roleId: verifyRole.id,
                            action: 'user_verified'
                        });

                        // Analytics para dashboard
                        if (global.socketManager) {
                            global.socketManager.broadcast('verification', {
                                userId: interaction.user.id,
                                username: interaction.user.username,
                                timestamp: new Date().toISOString()
                            });
                        }

                    } catch (error) {
                        await errorHandler.handleInteractionError(interaction, error);
                    }
                    return;
                }

                // Botões do Painel de Tickets (tipos específicos)
                if (customId.startsWith('ticket_create_')) {
                    try {
                        const ticketType = customId.replace('ticket_create_', '');
                        const cacheKey = `${interaction.user.id}-${interaction.guild.id}-${ticketType}`;
                        
                        // Verificar cache anti-duplicação (5 segundos)
                        if (ticketCreationCache.has(cacheKey)) {
                            const lastCreation = ticketCreationCache.get(cacheKey);
                            if (Date.now() - lastCreation < 5000) {
                                logger.debug(`Bloqueando criação duplicada de ticket para ${interaction.user.tag}`);
                                         return await interaction.reply({
                                             content: `${EMOJIS.ERROR} Aguarda um momento antes de criar outro ticket!`,
                                             flags: MessageFlags.Ephemeral
                                         });
                                     }
                        }
                        
                        // Marcar no cache
                        ticketCreationCache.set(cacheKey, Date.now());
                        
                        logger.debug(`Criando ticket tipo: "${ticketType}" para ${interaction.user.tag}`);
                        logger.interaction('button', customId, interaction, true);
                        
                        // Delegar IMEDIATAMENTE para o sistema de tickets - sem defer
                        const ticketManager = interaction.client.ticketManager;
                        if (!ticketManager) {
                            logger.error('TicketManager não está inicializado!');
                            return await interaction.editReply({
                                content: `${EMOJIS.ERROR} Sistema de tickets não está disponível no momento.`
                            });
                        }

                        // Delegar para o TicketManager
                        try {
                            await ticketManager.handleTicketCreate(interaction, ticketType);
                        } catch (error) {
                            logger.error('Erro ao criar ticket:', error);
                            if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply({
                                    content: `${EMOJIS.ERROR} Ocorreu um erro ao criar o ticket. Por favor, tente novamente.`,
                                    flags: MessageFlags.Ephemeral
                                });
                            } else {
                                await interaction.editReply({
                                    content: `${EMOJIS.ERROR} Ocorreu um erro ao criar o ticket. Por favor, tente novamente.`
                                });
                            }
                        }

                    } catch (error) {
                        await errorHandler.handleInteractionError(interaction, error);
                    }
                    return;
                }

                // Fechar Ticket
                if (customId === BUTTON_IDS.CLOSE_TICKET) {
                    try {
                        logger.debug(`Botão fechar ticket clicado por ${interaction.user.tag}`);
                        logger.interaction('button', customId, interaction, true);
                        
                        const confirmEmbed = new EmbedBuilder()
                            .setTitle('⚠️ Confirmar Encerramento')
                            .setDescription('Tens a certeza que queres fechar este ticket?')
                            .setColor(EMBED_COLORS.WARNING);

                        const confirmButtons = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(BUTTON_IDS.CONFIRM_CLOSE)
                                    .setLabel(`${EMOJIS.SUCCESS} Sim, Fechar`)
                                    .setStyle(ButtonStyle.Danger),
                                new ButtonBuilder()
                                    .setCustomId(BUTTON_IDS.CANCEL_CLOSE)
                                    .setLabel(`${EMOJIS.ERROR} Cancelar`)
                                    .setStyle(ButtonStyle.Secondary)
                            );

                        logger.debug(`Embed de confirmação criado`);
                        await interaction.reply({
                            embeds: [confirmEmbed],
                            components: [confirmButtons],
                            flags: MessageFlags.Ephemeral
                        });

                        // Limpar cache após sucesso (remover qualquer entrada para este user+guild)
                        setTimeout(() => {
                            try {
                                const prefix = `${interaction.user.id}-${interaction.guild.id}-`;
                                for (const key of ticketCreationCache.keys()) {
                                    if (key.startsWith(prefix)) ticketCreationCache.delete(key);
                                }
                            } catch (e) {
                                logger.warn('Erro ao limpar ticketCreationCache por prefix', { error: e && e.message ? e.message : e });
                            }
                        }, 10000); // 10 segundos

                    } catch (error) {
                        logger.error('Erro na criação de ticket:', { error: error.message || error });
                        
                        // Limpar cache em caso de erro (remover qualquer entrada para este user+guild)
                        try {
                            const prefix = `${interaction.user.id}-${interaction.guild.id}-`;
                            for (const key of ticketCreationCache.keys()) {
                                if (key.startsWith(prefix)) ticketCreationCache.delete(key);
                            }
                        } catch (e) {
                            logger.warn('Erro ao limpar ticketCreationCache no catch', { error: e && e.message ? e.message : e });
                        }
                        
                        // Tentar responder apenas se a interação ainda estiver válida
                        try {
                            if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply({
                                    content: `${EMOJIS.ERROR} Erro ao criar ticket. Tenta novamente!`,
                                    flags: MessageFlags.Ephemeral
                                });
                            } else if (interaction.deferred) {
                                await interaction.editReply({
                                    content: `${EMOJIS.ERROR} Erro ao criar ticket. Tenta novamente!`
                                });
                            }
                        } catch (responseError) {
                            logger.error('Erro ao responder interação:', { error: responseError.message || responseError });
                        }
                    }
                    return;
                }

                // Confirmar fecho do ticket
                if (customId === BUTTON_IDS.CONFIRM_CLOSE) {
                    try {
                        logger.debug(`Confirmação de fecho de ticket por ${interaction.user.tag}`);
                        logger.interaction('button', customId, interaction, true);
                        
                        const closedEmbed = new EmbedBuilder()
                            .setTitle('🔒 Ticket Fechado')
                            .setDescription(`Ticket fechado por ${interaction.user}`)
                            .addFields(
                                { name: '🕐 Fechado em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                            )
                            .setColor(EMBED_COLORS.ERROR)
                            .setTimestamp();

                        logger.debug(`Enviando embed de fechamento`);
                        await interaction.channel.send({ embeds: [closedEmbed] });
                        // Persistir status no DB e enviar webhook de arquivo
                        try {
                            const db = new Database();
                            await db.initialize();
                            // Buscar ticket pelo channel_id
                            const ticketRecord = await db.getTicketByChannelId(interaction.channel.id);
                            if (ticketRecord) {
                                await db.updateTicketStatus(ticketRecord.id, 'closed', interaction.user.id, `Fechado via interação por ${interaction.user.tag}`);
                                await db.updateTicket(ticketRecord.id, { archived: 1 });

                                // 🔥 ENVIAR LOG SIMPLIFICADO PARA WEBHOOK
                                try {
                                    const ticketManager = interaction.client.ticketManager;
                                    if (ticketManager) {
                                        // Coletar mensagens para transcript
                                        let transcriptText = '';
                                        try {
                                            const messages = await db.db ? await new Promise((res, rej) => {
                                                db.db.all('SELECT tm.user_id, u.username, tm.message, tm.created_at FROM ticket_messages tm LEFT JOIN users u ON tm.user_id = u.discord_id WHERE tm.ticket_id = ? ORDER BY tm.id ASC', [ticketRecord.id], (err, rows) => {
                                                    if (err) return rej(err);
                                                    res(rows || []);
                                                });
                                            }) : [];
                                            
                                            // Gerar transcript textual
                                            transcriptText = `TRANSCRIÇÃO DO TICKET #${ticketRecord.id}
========================================
Data de criação: ${new Date(ticketRecord.created_at).toLocaleString('pt-BR')}
Usuário: ${ticketRecord.user_id}
Canal: #${interaction.channel.name}
Servidor: ${interaction.guild.name}
========================================

`;
                                            
                                            if (messages && messages.length > 0) {
                                                messages.forEach(msg => {
                                                    const timestamp = new Date(msg.created_at).toLocaleTimeString('pt-BR');
                                                    transcriptText += `[${timestamp}] ${msg.username || 'Usuário'}: ${msg.message}\n`;
                                                });
                                            } else {
                                                transcriptText += '(Nenhuma mensagem registrada)\n';
                                            }
                                            
                                            transcriptText += `\n========================================
Ticket fechado por: ${interaction.user.tag}
Data de fechamento: ${new Date().toLocaleString('pt-BR')}
========================================`;
                                        } catch (transcriptError) {
                                            logger.warn('Erro ao gerar transcript:', transcriptError);
                                            transcriptText = `Erro ao gerar transcript para ticket #${ticketRecord.id}`;
                                        }

                                        // Buscar informações do autor e staff
                                        const author = await interaction.client.users.fetch(ticketRecord.user_id).catch(() => null);
                                        const assignedStaff = ticketRecord.assigned_to ? await interaction.client.users.fetch(ticketRecord.assigned_to).catch(() => null) : null;

                                        const logData = {
                                            ticketId: ticketRecord.id,
                                            author: author || { id: ticketRecord.user_id, tag: 'Usuário Desconhecido' },
                                            claimedBy: assignedStaff,
                                            closedBy: interaction.user,
                                            transcript: transcriptText,
                                            guild: interaction.guild,
                                            duration: ticketManager.calculateDuration(ticketRecord.created_at),
                                            reason: 'Ticket resolvido'
                                        };

                                        await ticketManager.enviarLog(interaction.guildId, 'close', logData);
                                        logger.info(`📨 Log simplificado enviado para ticket #${ticketRecord.id}`);
                                    }
                                } catch (logError) {
                                    logger.error('Erro ao enviar log simplificado:', logError);
                                }

                                    // Enviar webhooks de arquivo (suporta múltiplos) se configurados e ainda não enviados
                                    try {
                                        const guildId = interaction.guild ? interaction.guild.id : ticketRecord.guild_id;
                                        const webhooks = guildId ? await db.getGuildWebhooks(guildId) : [];

                                        logger.info('Resolved archive webhooks for ticket close', { guildId, webhooksCount: Array.isArray(webhooks) ? webhooks.length : 0, ticketId: ticketRecord?.id });

                                        if (webhooks && webhooks.length > 0 && !ticketRecord?.bug_webhook_sent) {
                                            // collect ticket messages to include in webhook (if present in DB)
                                            let messages = [];
                                            try {
                                                messages = await db.db ? await new Promise((res, rej) => {
                                                    db.db.all('SELECT tm.user_id, u.username, tm.message, tm.created_at FROM ticket_messages tm LEFT JOIN users u ON tm.user_id = u.discord_id WHERE tm.ticket_id = ? ORDER BY tm.id ASC', [ticketRecord.id], (err, rows) => {
                                                        if (err) return rej(err);
                                                        res(rows || []);
                                                    });
                                                }) : [];
                                            } catch (msgErr) {
                                                logger.warn('Failed to fetch ticket messages for webhook excerpt', { error: msgErr && msgErr.message ? msgErr.message : msgErr, ticketId: ticketRecord.id });
                                                messages = [];
                                            }

                                            // Build transcript URL for dashboard viewer
                                            const serverHost = (process.env.WEBSITE_HOST || process.env.HOST || null);
                                            const serverPort = (process.env.WEBSITE_PORT || process.env.PORT || null);
                                            let transcriptUrl = null;
                                            try {
                                                // Prefer to construct from request host if available via config or environment
                                                // Fallback to using dashboard origin if known
                                                const base = process.env.WEBSITE_BASE_URL || (serverHost ? `http${process.env.WEBSITE_SSL === 'true' ? 's' : ''}://${serverHost}${serverPort ? `:${serverPort}` : ''}` : null);
                                                if (base) transcriptUrl = `${base.replace(/\/$/, '')}/transcript/${ticketRecord.id}`;
                                            } catch (uErr) {
                                                transcriptUrl = null;
                                            }

                                            let anySent = false;
                                            for (const wh of webhooks) {
                                                try {
                                                    logger.info('Attempting to send archive webhook', { webhookId: wh.id, webhookUrl: wh.url, ticketId: ticketRecord.id });
                                                    const payloadTicket = Object.assign({}, ticketRecord, { messages, transcriptUrl });
                                                    const sent = await sendArchivedTicketWebhook(wh.url, payloadTicket, `Fechado por ${interaction.user.tag}`);
                                                    if (sent) {
                                                        anySent = true;
                                                        logger.info('Archive webhook sent', { webhookId: wh.id, ticketId: ticketRecord.id });
                                                        try { await db.createLog(ticketRecord.guild_id, 'webhook_sent', { ticketId: ticketRecord.id, webhookId: wh.id, webhookUrl: wh.url }); } catch(_){}
                                                    } else {
                                                        logger.warn('Webhook sender returned falsy for webhook id', { webhookId: wh.id, ticketId: ticketRecord.id });
                                                        try { await db.createLog(ticketRecord.guild_id, 'webhook_failed', { ticketId: ticketRecord.id, webhookId: wh.id, webhookUrl: wh.url }); } catch(_){}
                                                    }
                                                } catch (e) {
                                                    logger.warn('Falha ao enviar webhook específico', { webhookId: wh.id, error: e && e.message ? e.message : e });
                                                }
                                            }

                                            if (anySent) {
                                                await db.markTicketWebhookSent(ticketRecord.id);
                                                logger.info('Marked ticket as webhook-sent because at least one webhook succeeded', { ticketId: ticketRecord.id });
                                            } else {
                                                // If none succeeded, fallback to log channel
                                                try {
                                                    const logCfg = guildId ? await db.getGuildConfig(guildId, 'log_channel_id') : null;
                                                    const logChannelId = logCfg?.value || null;
                            if (logChannelId) {
                                                        const logChannel = interaction.guild?.channels.cache.get(logChannelId) || await client.channels.fetch(logChannelId).catch(() => null);
                                                                if (logChannel && logChannel.send) {
                                                                    // Skip posting to channels named like 'ticket-log' to avoid duplicate noisy posts
                                                                    const forbiddenNames = ['ticket-log','tickets-log','ticket-logs','tickets_log','logs-tickets'];
                                                                    const chName = (logChannel.name || '').toLowerCase();
                                                                    const isForbidden = forbiddenNames.includes(chName) || forbiddenNames.some(n => chName.includes(n));
                                                                    if (isForbidden) {
                                                                        logger.info('Skipping fallback post to log channel due to channel name blacklist', { guildId, logChannelId, channelName: logChannel.name, ticketId: ticketRecord.id });
                                                                    } else {
                                                                        await logChannel.send(`📦 Arquivo de ticket (fallback): Ticket ${ticketRecord.id} do servidor ${interaction.guild?.name || guildId} - canal: <#${ticketRecord.channel_id}>`);
                                                                        logger.info('Fallback: posted archive info to log channel', { guildId, logChannelId, ticketId: ticketRecord.id });
                                                                        try { await db.createLog(guildId, 'webhook_fallback_logchannel', { ticketId: ticketRecord.id, logChannelId }); } catch(_){ }
                                                                    }
                                                        } else {
                                                            logger.warn('Fallback log channel not found or not sendable', { guildId, logChannelId });
                                                        }
                                                    } else {
                                                        logger.debug('No log_channel_id configured for fallback', { guildId });
                                                        try {
                                                            // As a last resort, check global config.ticketSystem.logServerId (local config backup)
                                                            const localCfg = require('../..//config.json') || require('../../config.json.backup');
                                                            const fallbackServerId = localCfg?.ticketSystem?.logServerId || localCfg?.logServerId || null;
                                                            if (fallbackServerId) {
                                                                logger.info('Attempting global-config fallback to logServerId', { fallbackServerId, guildId, ticketId: ticketRecord.id });
                                                                // Try to find a text channel in that server to post a minimal fallback message
                                                                const fallbackGuild = client.guilds.cache.get(fallbackServerId) || await client.guilds.fetch(fallbackServerId).catch(() => null);
                                                                if (fallbackGuild) {
                                                                    // prefer system channel, then first text channel the bot can send in
                                                                    let targetChannel = fallbackGuild.systemChannel || null;
                                                                    if (!targetChannel) {
                                                                        const channels = await fallbackGuild.channels.fetch().catch(() => null);
                                                                        if (channels) {
                                                                            for (const ch of channels.values()) {
                                                                                if (ch && ch.type === 0 && ch.permissionsFor && ch.permissionsFor(client.user).has('SendMessages')) { // 0 = GuildText in v14 representation
                                                                                    targetChannel = ch;
                                                                                    break;
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                    if (targetChannel && targetChannel.send) {
                                                                        await targetChannel.send(`📦 Arquivo de ticket (global fallback): Ticket ${ticketRecord.id} do servidor ${interaction.guild?.name || guildId} - canal: <#${ticketRecord.channel_id}>`)
                                                                        .catch(() => null);
                                                                        try { await db.createLog(guildId, 'webhook_fallback_global', { ticketId: ticketRecord.id, fallbackServerId }); } catch(_){ }
                                                                        logger.info('Global fallback posted to configured logServerId', { fallbackServerId, ticketId: ticketRecord.id });
                                                                    } else {
                                                                        logger.warn('Global fallback server found but no suitable channel to post', { fallbackServerId, ticketId: ticketRecord.id });
                                                                    }
                                                                } else {
                                                                    logger.warn('Global fallback server not found or bot not a member', { fallbackServerId, ticketId: ticketRecord.id });
                                                                }
                                                            }
                                                        } catch (globalFbErr) {
                                                            logger.warn('Error during global fallback attempt', { error: globalFbErr && globalFbErr.message ? globalFbErr.message : globalFbErr, ticketId: ticketRecord.id });
                                                        }
                                                    }
                                                } catch (fbErr) {
                                                    logger.warn('Error during fallback posting to log channel', { error: fbErr && fbErr.message ? fbErr.message : fbErr, ticketId: ticketRecord.id });
                                                }
                                                // Private endpoint logging disabled (website integration removed)
                                                // const privateEndpoint = process.env.PRIVATE_LOG_ENDPOINT || null;
                                                // if (privateEndpoint) { ... }
                                            }
                                        } else {
                                            logger.debug('No archive webhooks configured or already sent for this ticket', { guildId, ticketId: ticketRecord?.id });
                                        }
                                    } catch (webErr) {
                                        logger.warn('Erro ao enviar webhooks de arquivo durante fechamento por interação', { error: webErr && webErr.message ? webErr.message : webErr, ticketId: ticketRecord?.id });
                                        // Try fallback to guild log channel if configured
                                        try {
                                            const guildId = interaction.guild ? interaction.guild.id : ticketRecord.guild_id;
                                            const logCfg = guildId ? await db.getGuildConfig(guildId, 'log_channel_id') : null;
                                            const logChannelId = logCfg?.value || null;
                                            if (logChannelId) {
                                                const logChannel = interaction.guild?.channels.cache.get(logChannelId) || await client.channels.fetch(logChannelId).catch(() => null);
                                                if (logChannel && logChannel.send) {
                                                    await logChannel.send(`📦 Arquivo de ticket (fallback due to error): Ticket ${ticketRecord.id} do servidor ${interaction.guild?.name || guildId} - canal: <#${ticketRecord.channel_id}>`);
                                                    logger.info('Fallback after error: posted archive info to log channel', { guildId, logChannelId, ticketId: ticketRecord.id });
                                                } else {
                                                    logger.warn('Fallback log channel not found or not sendable (after error)', { guildId, logChannelId });
                                                }
                                            } else {
                                                logger.debug('No log_channel_id configured for fallback (after error)', { guildId });
                                            }
                                        } catch (fbErr) {
                                            logger.error('Error during fallback posting to log channel (after webhook error)', { error: fbErr && fbErr.message ? fbErr.message : fbErr, ticketId: ticketRecord?.id });
                                        }
                                    }
                            }
                        } catch (dbErr) {
                            logger.warn('Erro ao atualizar ticket no DB durante fechamento por interação', { error: dbErr && dbErr.message ? dbErr.message : dbErr });
                        }
                        
                        // Log estruturado
                        logger.database('ticket_closed', {
                            userId: interaction.user.id,
                            channelId: interaction.channel.id,
                            guildId: interaction.guild.id,
                            closedBy: interaction.user.tag
                        });

                        // Analytics para dashboard
                        if (global.socketManager) {
                            global.socketManager.broadcast('ticket_closed', {
                                userId: interaction.user.id,
                                username: interaction.user.username,
                                channelId: interaction.channel.id,
                                timestamp: new Date().toISOString()
                            });
                        }

                        logger.debug(`Respondendo com confirmação de fechamento`);
                        await interaction.reply({
                            content: `${EMOJIS.SUCCESS} Ticket será fechado em 5 segundos...`,
                            flags: MessageFlags.Ephemeral
                        });

                        logger.debug(`Iniciando timeout para deletar canal em 5 segundos`);
                        // Capture channel id now in case interaction.channel becomes null later
                        const channelIdToDelete = interaction.channel?.id;
                        setTimeout(async () => {
                            try {
                                if (!channelIdToDelete) {
                                    logger.warn('Nenhum canal para deletar (channelId ausente)');
                                    return;
                                }

                                // Try to get a fresh channel reference from the guild cache or via API
                                let channel = interaction.guild?.channels.cache.get(channelIdToDelete) || null;
                                if (!channel && client && client.channels) {
                                    try {
                                        channel = await client.channels.fetch(channelIdToDelete).catch(() => null);
                                    } catch (e) {
                                        channel = null;
                                    }
                                }

                                if (!channel) {
                                    logger.warn('Canal já removido ou não encontrado ao tentar deletar', { channelId: channelIdToDelete });
                                    return;
                                }

                                logger.debug(`Tentando deletar canal ${channelIdToDelete}`);
                                await channel.delete();
                                logger.info('Canal deletado com sucesso', { channelId: channelIdToDelete });
                            } catch (error) {
                                logger.error('Erro ao deletar canal de ticket', { 
                                    channelId: channelIdToDelete,
                                    error: error.message || error
                                });
                            }
                        }, 5000);

                    } catch (error) {
                        logger.error('Erro no processo de fechar ticket:', { error: error.message || error });
                        await errorHandler.handleInteractionError(interaction, error);
                    }
                    return;
                }

                // Cancelar fecho
                if (customId === BUTTON_IDS.CANCEL_CLOSE) {
                    logger.debug(`Cancelar fecho de ticket por ${interaction.user.tag}`);
                     await interaction.reply({
                         content: `${EMOJIS.SUCCESS} Fecho cancelado.`,
                         flags: MessageFlags.Ephemeral
                     });
                     return;
                 }

                // Painel do ticket - chamar membro
                if (customId === BUTTON_IDS.TICKET_CALL_MEMBER) {
                    try {
                        await interaction.reply({ content: 'Indica o ID ou menção do membro que queres chamar (responde neste chat):', flags: MessageFlags.Ephemeral });
                    } catch (err) {
                        logger.warn('Erro ao pedir ID para chamar membro', { error: err && err.message ? err.message : err });
                    }
                    return;
                }

                // Adicionar membro ao ticket (abre modal para inserir ID)
                if (customId === BUTTON_IDS.TICKET_ADD_MEMBER) {
                    try {
                        const modal = new ModalBuilder().setCustomId('modal_add_member').setTitle('Adicionar Membro ao Ticket');
                        // existing project may not have TextInputBuilder imported here; create if needed
                        const TextInput = TextInputBuilder;
                        const input = new TextInput().setCustomId('add_member_id').setLabel('ID ou menção do utilizador').setStyle(TextInputStyle.Short).setRequired(true);
                        const row = new ActionRowBuilder().addComponents(input);
                        modal.addComponents(row);
                        await interaction.showModal(modal);
                    } catch (err) {
                        logger.warn('Erro ao abrir modal para adicionar membro', { error: err && err.message ? err.message : err });
                    }
                    return;
                }

                // Remover membro do ticket (abre modal)
                if (customId === BUTTON_IDS.TICKET_REMOVE_MEMBER) {
                    try {
                        const modal = new ModalBuilder().setCustomId('modal_remove_member').setTitle('Remover Membro do Ticket');
                        const TextInput = TextInputBuilder;
                        const input = new TextInput().setCustomId('remove_member_id').setLabel('ID ou menção do utilizador').setStyle(TextInputStyle.Short).setRequired(true);
                        const row = new ActionRowBuilder().addComponents(input);
                        modal.addComponents(row);
                        await interaction.showModal(modal);
                    } catch (err) {
                        logger.warn('Erro ao abrir modal para remover membro', { error: err && err.message ? err.message : err });
                    }
                    return;
                }

                // Mover ticket (abre modal com nome da categoria alvo)
                if (customId === BUTTON_IDS.TICKET_MOVE) {
                    try {
                        const modal = new ModalBuilder().setCustomId('modal_move_ticket').setTitle('Mover Ticket para Categoria');
                        const TextInput = TextInputBuilder;
                        const input = new TextInput().setCustomId('move_category_name').setLabel('Nome da categoria (ex: Tickets-Arquivados)').setStyle(TextInputStyle.Short).setRequired(true);
                        const row = new ActionRowBuilder().addComponents(input);
                        modal.addComponents(row);
                        await interaction.showModal(modal);
                    } catch (err) {
                        logger.warn('Erro ao abrir modal para mover ticket', { error: err && err.message ? err.message : err });
                    }
                    return;
                }

                // Trocar nome do canal
                if (customId === BUTTON_IDS.TICKET_RENAME_CHANNEL) {
                    try {
                        const modal = new ModalBuilder().setCustomId('modal_rename_channel').setTitle('Trocar Nome do Canal');
                        const TextInput = TextInputBuilder;
                        const input = new TextInput().setCustomId('new_channel_name').setLabel('Novo nome do canal (sem espaços)').setStyle(TextInputStyle.Short).setRequired(true);
                        const row = new ActionRowBuilder().addComponents(input);
                        modal.addComponents(row);
                        await interaction.showModal(modal);
                    } catch (err) {
                        logger.warn('Erro ao abrir modal para renomear canal', { error: err && err.message ? err.message : err });
                    }
                    return;
                }

                // Saudar atendimento (mensagem pronta)
                if (customId === BUTTON_IDS.TICKET_GREET) {
                    try {
                        const greeting = `Olá! Bem-vindo ao atendimento — em que posso ajudar hoje?`;
                        await interaction.channel.send({ content: greeting });
                        await interaction.reply({ content: `${EMOJIS.SUCCESS} Mensagem de saudação enviada.`, flags: MessageFlags.Ephemeral });
                    } catch (err) {
                        logger.warn('Erro ao enviar saudação no ticket', { error: err && err.message ? err.message : err });
                        await interaction.reply({ content: `${EMOJIS.ERROR} Não foi possível enviar a saudação.`, flags: MessageFlags.Ephemeral });
                    }
                    return;
                }

                // Observação interna (abre modal e grava no DB como log interno)
                if (customId === BUTTON_IDS.TICKET_INTERNAL_NOTE) {
                    try {
                        const modal = new ModalBuilder().setCustomId('modal_internal_note').setTitle('Adicionar Observação Interna');
                        const TextInput = TextInputBuilder;
                        const input = new TextInput().setCustomId('internal_note_text').setLabel('Observação').setStyle(TextInputStyle.Paragraph).setRequired(true);
                        const row = new ActionRowBuilder().addComponents(input);
                        modal.addComponents(row);
                        await interaction.showModal(modal);
                    } catch (err) {
                        logger.warn('Erro ao abrir modal para observação interna', { error: err && err.message ? err.message : err });
                    }
                    return;
                }

                // Finalizar ticket (equivalente a fechar)
                if (customId === BUTTON_IDS.TICKET_FINALIZE) {
                    try {
                        // Reutilizar fluxo de fechar ticket (abrir confirmação)
                        const confirmEmbed = new EmbedBuilder()
                            .setTitle('⚠️ Finalizar Ticket')
                            .setDescription('Tens a certeza que queres finalizar este ticket?')
                            .setColor(EMBED_COLORS.WARNING);

                        const confirmButtons = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(BUTTON_IDS.CONFIRM_CLOSE)
                                    .setLabel(`${EMOJIS.SUCCESS} Sim, Finalizar`)
                                    .setStyle(ButtonStyle.Danger),
                                new ButtonBuilder()
                                    .setCustomId(BUTTON_IDS.CANCEL_CLOSE)
                                    .setLabel(`${EMOJIS.ERROR} Cancelar`)
                                    .setStyle(ButtonStyle.Secondary)
                            );

                        await interaction.reply({ embeds: [confirmEmbed], components: [confirmButtons], flags: MessageFlags.Ephemeral });
                    } catch (err) {
                        logger.warn('Erro ao iniciar finalização do ticket', { error: err && err.message ? err.message : err });
                    }
                    return;
                }

                // Sistema de Tags
                if (customId.startsWith('request_tag_')) {
                    try {
                        const tagName = customId.replace('request_tag_', '');
                        logger.interaction('button', customId, interaction, true);
                        
                        const modal = new ModalBuilder()
                            .setCustomId(`tag_modal_${tagName}`)
                            .setTitle(`Solicitar Tag: ${tagName}`);

                        const reasonInput = new TextInputBuilder()
                            .setCustomId('tag_reason')
                            .setLabel('Motivo da solicitação')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Explica porque mereces esta tag...')
                            .setRequired(true)
                            .setMinLength(10)
                            .setMaxLength(500);

                        const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
                        modal.addComponents(firstActionRow);

                        await interaction.showModal(modal);
                        
                    } catch (error) {
                        await errorHandler.handleInteractionError(interaction, error);
                    }
                    return;
                }
            }

            // Modals
            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('tag_modal_')) {
                    try {
                        const tagName = interaction.customId.replace('tag_modal_', '');
                        const reason = interaction.fields.getTextInputValue('tag_reason');

                        // Log da solicitação
                        logger.database('tag_request', {
                            userId: interaction.user.id,
                            tagName,
                            reason: reason.substring(0, 100),
                            guildId: interaction.guild.id
                        });

                        const confirmEmbed = new EmbedBuilder()
                            .setTitle(`${EMOJIS.SUCCESS} Solicitação Enviada`)
                            .setDescription(`A tua solicitação para a tag **${tagName}** foi enviada!`)
                            .addFields(
                                { name: '📝 Motivo', value: reason },
                                { name: '⏰ Status', value: '🟡 Pendente' }
                            )
                            .setColor(EMBED_COLORS.WARNING)
                            .setTimestamp();

                        await interaction.reply({
                            embeds: [confirmEmbed],
                            flags: MessageFlags.Ephemeral
                        });

                        // Analytics para dashboard
                        if (global.socketManager) {
                            global.socketManager.broadcast('tag_request', {
                                userId: interaction.user.id,
                                username: interaction.user.username,
                                tagName,
                                timestamp: new Date().toISOString()
                            });
                        }

                    } catch (error) {
                        await errorHandler.handleInteractionError(interaction, error);
                    }
                    return;
                }
                // Add member modal
                if (interaction.customId === 'modal_add_member') {
                    try {
                        const userInput = interaction.fields.getTextInputValue('add_member_id').trim();
                        const userId = userInput.replace(/[^0-9]/g, '');
                        if (!userId) return interaction.reply({ content: `${EMOJIS.ERROR} ID inválido.`, flags: MessageFlags.Ephemeral });

                        const guild = interaction.guild;
                        if (!guild) return interaction.reply({ content: `${EMOJIS.ERROR} Guild não disponível.`, flags: MessageFlags.Ephemeral });

                        try {
                            const member = await guild.members.fetch(userId);
                            // Add permission overwrite for member on this channel
                            await interaction.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, ReadMessageHistory: true, SendMessages: true });
                            await interaction.reply({ content: `${EMOJIS.SUCCESS} Membro adicionado ao ticket: ${member.user.tag}`, flags: MessageFlags.Ephemeral });
                        } catch (err) {
                            logger.warn('Erro ao buscar/adicionar membro ao ticket', { error: err && err.message ? err.message : err });
                            await interaction.reply({ content: `${EMOJIS.ERROR} Não foi possível adicionar o membro.`, flags: MessageFlags.Ephemeral });
                        }
                    } catch (err) {
                        await errorHandler.handleInteractionError(interaction, err);
                    }
                    return;
                }

                // Remove member modal
                if (interaction.customId === 'modal_remove_member') {
                    try {
                        const userInput = interaction.fields.getTextInputValue('remove_member_id').trim();
                        const userId = userInput.replace(/[^0-9]/g, '');
                        if (!userId) return interaction.reply({ content: `${EMOJIS.ERROR} ID inválido.`, flags: MessageFlags.Ephemeral });

                        try {
                            await interaction.channel.permissionOverwrites.delete(userId);
                            await interaction.reply({ content: `${EMOJIS.SUCCESS} Permissões removidas para ${userId}`, flags: MessageFlags.Ephemeral });
                        } catch (err) {
                            logger.warn('Erro ao remover permissões do membro', { error: err && err.message ? err.message : err });
                            await interaction.reply({ content: `${EMOJIS.ERROR} Não foi possível remover o membro.`, flags: MessageFlags.Ephemeral });
                        }
                    } catch (err) {
                        await errorHandler.handleInteractionError(interaction, err);
                    }
                    return;
                }

                // Move ticket modal
                if (interaction.customId === 'modal_move_ticket') {
                    try {
                        const categoryName = interaction.fields.getTextInputValue('move_category_name').trim();
                        const guild = interaction.guild;
                        if (!guild) return interaction.reply({ content: `${EMOJIS.ERROR} Guild não disponível.`, flags: MessageFlags.Ephemeral });

                        let target = guild.channels.cache.find(c => c.type === 4 && c.name.toLowerCase() === categoryName.toLowerCase());
                        if (!target) {
                            // create category
                            target = await guild.channels.create({ name: categoryName, type: 4, reason: 'Mover ticket via painel' });
                        }
                        await interaction.channel.setParent(target.id);
                        await interaction.reply({ content: `${EMOJIS.SUCCESS} Ticket movido para categoria ${target.name}`, flags: MessageFlags.Ephemeral });
                    } catch (err) {
                        logger.warn('Erro ao mover ticket', { error: err && err.message ? err.message : err });
                        await interaction.reply({ content: `${EMOJIS.ERROR} Não foi possível mover o ticket.`, flags: MessageFlags.Ephemeral });
                    }
                    return;
                }

                // Rename channel modal
                if (interaction.customId === 'modal_rename_channel') {
                    try {
                        const newName = interaction.fields.getTextInputValue('new_channel_name').trim();
                        if (!newName) return interaction.reply({ content: `${EMOJIS.ERROR} Nome inválido.`, flags: MessageFlags.Ephemeral });
                        await interaction.channel.setName(newName);
                        await interaction.reply({ content: `${EMOJIS.SUCCESS} Canal renomeado para ${newName}`, flags: MessageFlags.Ephemeral });
                    } catch (err) {
                        logger.warn('Erro ao renomear canal', { error: err && err.message ? err.message : err });
                        await interaction.reply({ content: `${EMOJIS.ERROR} Não foi possível renomear o canal.`, flags: MessageFlags.Ephemeral });
                    }
                    return;
                }

                // Internal note modal
                if (interaction.customId === 'modal_internal_note') {
                    try {
                        const note = interaction.fields.getTextInputValue('internal_note_text').trim();
                        if (!note) return interaction.reply({ content: `${EMOJIS.ERROR} Observação vazia.`, flags: MessageFlags.Ephemeral });

                        // Persistir no DB como log interno (ticket_note)
                        try {
                            const db = new Database();
                            await db.initialize();
                            const ticket = await db.getTicketByChannelId(interaction.channel.id);
                            if (ticket) {
                                await db.createLog(ticket.guild_id, 'ticket_internal_note', { ticketId: ticket.id, note: note.substring(0, 1000), author: interaction.user.id });
                                await interaction.reply({ content: `${EMOJIS.SUCCESS} Observação interna adicionada.`, flags: MessageFlags.Ephemeral });
                            } else {
                                await interaction.reply({ content: `${EMOJIS.ERROR} Ticket não encontrado no DB.`, flags: MessageFlags.Ephemeral });
                            }
                        } catch (dbErr) {
                            logger.warn('Erro ao gravar observação interna', { error: dbErr && dbErr.message ? dbErr.message : dbErr });
                            await interaction.reply({ content: `${EMOJIS.ERROR} Erro ao gravar observação.`, flags: MessageFlags.Ephemeral });
                        }
                    } catch (err) {
                        await errorHandler.handleInteractionError(interaction, err);
                    }
                    return;
                }

                // ========================================
                // SISTEMA AVANÇADO DE PAINÉIS - NOVO
                // ========================================
                
                // Handler para menu de seleção de categoria
                if (customId === 'ticket_category_select') {
                    try {
                        const selectedCategory = interaction.values[0];
                        const categoryType = selectedCategory.replace('ticket_', '');
                        
                        // Verificar se usuário já tem ticket aberto
                        const existingTicket = interaction.guild.channels.cache.find(channel => 
                            channel.name.includes(interaction.user.username.toLowerCase()) && 
                            channel.name.includes('ticket')
                        );
                        
                        if (existingTicket) {
                            return await interaction.reply({
                                content: `⚠️ **Ticket Existente**\\nVocê já possui um ticket aberto: ${existingTicket}\\nFeche o ticket atual antes de abrir um novo.`,
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        // Criar modal baseado na categoria
                        const modal = new ModalBuilder()
                            .setCustomId(`ticket_modal_${categoryType}`)
                            .setTitle(`🎫 ${getCategoryDisplayName(categoryType)}`);

                        const subjectInput = new TextInputBuilder()
                            .setCustomId('ticket_subject')
                            .setLabel('Assunto do Ticket')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Descreva brevemente o motivo do contato...')
                            .setRequired(true)
                            .setMaxLength(100);

                        const descriptionInput = new TextInputBuilder()
                            .setCustomId('ticket_description')
                            .setLabel('Descrição Detalhada')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder(getPlaceholderText(categoryType))
                            .setRequired(true)
                            .setMaxLength(1000);

                        const priorityInput = new TextInputBuilder()
                            .setCustomId('ticket_priority')
                            .setLabel('Prioridade (baixa/média/alta)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('baixa')
                            .setRequired(false)
                            .setMaxLength(10);

                        modal.addComponents(
                            new ActionRowBuilder().addComponents(subjectInput),
                            new ActionRowBuilder().addComponents(descriptionInput),
                            new ActionRowBuilder().addComponents(priorityInput)
                        );

                        await interaction.showModal(modal);
                    } catch (error) {
                        logger.error('Erro no menu de categoria:', error);
                        await interaction.reply({
                            content: '❌ Erro ao processar seleção. Tente novamente.',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    return;
                }

                // Handler para botões de ação rápida
                if (customId === 'ticket_emergency') {
                    try {
                        // Criar ticket de emergência imediatamente
                        const category = await getOrCreateTicketCategory(interaction.guild);
                        const channelName = `🚨emergency-${interaction.user.username}-${Date.now().toString().slice(-4)}`;

                        const ticketChannel = await interaction.guild.channels.create({
                            name: channelName,
                            type: ChannelType.GuildText,
                            parent: category.id,
                            permissionOverwrites: [
                                {
                                    id: interaction.guild.id,
                                    deny: [PermissionFlagsBits.ViewChannel]
                                },
                                {
                                    id: interaction.user.id,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                                }
                            ]
                        });

                        const emergencyEmbed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('🚨 TICKET DE EMERGÊNCIA')
                            .setDescription([
                                `**Usuário:** ${interaction.user}`,
                                `**Criado:** <t:${Math.floor(Date.now() / 1000)}:R>`,
                                '',
                                '⚠️ **ATENÇÃO EQUIPE**',
                                'Este é um ticket de emergência que requer atenção imediata.',
                                '',
                                'Por favor, descreva a situação de emergência:'
                            ].join('\\n'))
                            .setTimestamp();

                        await ticketChannel.send({
                            content: `${interaction.user} @here`,
                            embeds: [emergencyEmbed]
                        });

                        await interaction.reply({
                            content: `🚨 **Ticket de emergência criado:** ${ticketChannel}\\nNossa equipe foi notificada imediatamente.`,
                            flags: MessageFlags.Ephemeral
                        });

                    } catch (error) {
                        logger.error('Erro ao criar ticket emergência:', error);
                        await interaction.reply({
                            content: '❌ Erro ao criar ticket de emergência. Contacte um administrador.',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    return;
                }

                if (customId === 'ticket_status_check') {
                    const statusEmbed = new EmbedBuilder()
                        .setColor('#00D4AA')
                        .setTitle('📊 Status do Sistema')
                        .setDescription([
                            '### 🟢 **SISTEMA OPERACIONAL**',
                            '',
                            '✅ **Bot:** Online',
                            '✅ **Base de Dados:** Conectada', 
                            '✅ **Tickets:** Funcionais',
                            `✅ **Latência:** ${interaction.client.ws.ping}ms`,
                            '',
                            `🎫 **Tickets Ativos:** ${interaction.guild.channels.cache.filter(c => c.name.includes('ticket')).size}`,
                            `👥 **Staff Online:** ${interaction.guild.members.cache.filter(m => !m.user.bot && m.presence?.status !== 'offline').size}`
                        ].join('\\n'))
                        .setTimestamp();

                    await interaction.reply({ embeds: [statusEmbed], flags: MessageFlags.Ephemeral });
                    return;
                }

                if (customId === 'ticket_my_tickets') {
                    const userTickets = interaction.guild.channels.cache.filter(channel => 
                        channel.name.includes(interaction.user.username.toLowerCase()) && 
                        channel.name.includes('ticket')
                    );

                    const ticketsEmbed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('📋 Meus Tickets')
                        .setDescription(
                            userTickets.size > 0 
                                ? `Você possui **${userTickets.size}** ticket(s) ativo(s):\\n${userTickets.map(t => `• ${t}`).join('\\n')}`
                                : 'Você não possui tickets ativos no momento.'
                        )
                        .setTimestamp();

                    await interaction.reply({ embeds: [ticketsEmbed], flags: MessageFlags.Ephemeral });
                    return;
                }

                if (customId === 'ticket_faq') {
                    const faqEmbed = new EmbedBuilder()
                        .setColor('#FEE75C')
                        .setTitle('❓ Perguntas Frequentes')
                        .setDescription([
                            '### 🔍 **DÚVIDAS COMUNS**',
                            '',
                            '**P:** Como abrir um ticket?',
                            '**R:** Use o menu acima e selecione a categoria adequada.',
                            '',
                            '**P:** Quanto tempo demora o atendimento?',
                            '**R:** Nossa meta é responder em até 15 minutos.',
                            '',
                            '**P:** Posso ter múltiplos tickets?',
                            '**R:** Apenas um ticket por usuário por vez.',
                            '',
                            '**P:** Como fechar um ticket?',
                            '**R:** Clique no botão "Fechar Ticket" ou peça ao staff.',
                            '',
                            '💡 **Ainda com dúvidas?** Abra um ticket na categoria "Ajuda Geral"'
                        ].join('\\n'))
                        .setTimestamp();

                    await interaction.reply({ embeds: [faqEmbed], flags: MessageFlags.Ephemeral });
                    return;
                }

                // Handler para modais do sistema avançado
                if (customId.startsWith('ticket_modal_')) {
                    try {
                        const categoryType = customId.replace('ticket_modal_', '');
                        const subject = interaction.fields.getTextInputValue('ticket_subject');
                        const description = interaction.fields.getTextInputValue('ticket_description');
                        const priority = interaction.fields.getTextInputValue('ticket_priority') || 'média';

                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                        // Criar ticket avançado
                        const category = await getOrCreateTicketCategory(interaction.guild);
                        const channelName = `${getCategoryEmoji(categoryType)}-${categoryType}-${interaction.user.username}-${Date.now().toString().slice(-4)}`;

                        const ticketChannel = await interaction.guild.channels.create({
                            name: channelName,
                            type: ChannelType.GuildText,
                            parent: category.id,
                            topic: `Ticket: ${subject} | Usuário: ${interaction.user.tag} | Prioridade: ${priority}`,
                            permissionOverwrites: [
                                {
                                    id: interaction.guild.id,
                                    deny: [PermissionFlagsBits.ViewChannel]
                                },
                                {
                                    id: interaction.user.id,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                                }
                            ]
                        });

                        // Embed do ticket
                        const ticketEmbed = new EmbedBuilder()
                            .setColor(getPriorityColor(priority))
                            .setTitle(`🎫 **${getCategoryDisplayName(categoryType).toUpperCase()} TICKET**`)
                            .setDescription([
                                '### 📋 **INFORMAÇÕES DO TICKET**',
                                '',
                                `🏷️ **Categoria:** \`${getCategoryDisplayName(categoryType)}\``,
                                `👤 **Criado por:** ${interaction.user}`,
                                `⚡ **Prioridade:** \`${priority.toUpperCase()}\``,
                                `📅 **Data:** <t:${Math.floor(Date.now() / 1000)}:R>`,
                                `🆔 **ID:** \`${ticketChannel.id}\``,
                                '',
                                '### 💬 **ASSUNTO**',
                                `\`\`\`${subject}\`\`\``,
                                '',
                                '### 📝 **DESCRIÇÃO DETALHADA**',
                                `\`\`\`${description}\`\`\``,
                                '',
                                '### 🎯 **PRÓXIMOS PASSOS**',
                                '```',
                                '1️⃣ Staff assumirá o ticket',
                                '2️⃣ Análise do problema reportado',  
                                '3️⃣ Resolução personalizada',
                                '4️⃣ Confirmação de satisfação',
                                '```',
                                '',
                                '> 💡 **Nossa equipe responde em média 15 minutos**'
                            ].join('\\n'))
                            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                            .setImage('https://via.placeholder.com/600x100/5865F2/FFFFFF?text=IGNIS+SUPPORT+SYSTEM')
                            .setFooter({ 
                                text: `${interaction.guild.name} • IGNIS Ticket System • Ticket #${Date.now().toString().slice(-6)}`,
                                iconURL: interaction.guild.iconURL({ dynamic: true })
                            })
                            .setTimestamp();

                        // Botões de controle avançados
                        const controlButtons = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('ticket_claim')
                                    .setLabel('ASSUMIR TICKET')
                                    .setEmoji('👑')
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId('ticket_close')
                                    .setLabel('FECHAR TICKET')
                                    .setEmoji('🔒')
                                    .setStyle(ButtonStyle.Danger),
                                new ButtonBuilder()
                                    .setCustomId('ticket_priority_change')
                                    .setLabel('PRIORIDADE')
                                    .setEmoji('⚡')
                                    .setStyle(ButtonStyle.Secondary)
                            );

                        // Segunda linha de botões - Ações extras
                        const extraButtons = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('ticket_add_member')
                                    .setLabel('ADICIONAR MEMBRO')
                                    .setEmoji('➕')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId('ticket_transcript')
                                    .setLabel('TRANSCRIÇÃO')
                                    .setEmoji('📄')
                                    .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('ticket_escalate')
                                    .setLabel('ESCALAR')
                                    .setEmoji('📈')
                                    .setStyle(ButtonStyle.Secondary)
                            );

                        await ticketChannel.send({
                            content: `${interaction.user} **Ticket criado com sucesso!** 🎉\\n\\n🛎️ **Nossa equipe foi notificada e responderá em breve.**`,
                            embeds: [ticketEmbed],
                            components: [controlButtons, extraButtons]
                        });

                        await interaction.editReply({
                            content: `✅ **Ticket criado com sucesso!**\\n🎫 **Canal:** ${ticketChannel}\\n⚡ **Prioridade:** ${priority}`
                        });

                    } catch (error) {
                        logger.error('Erro ao criar ticket via modal:', error);
                        await interaction.editReply({
                            content: '❌ Erro ao criar ticket. Contacte um administrador.'
                        });
                    }
                    return;
                }
            }

        } catch (error) {
            await errorHandler.handleInteractionError(interaction, error);
        }
    }
};

// Funções auxiliares para o sistema avançado
function getCategoryDisplayName(category) {
    const names = {
        'technical': 'Suporte Técnico',
        'account': 'Problemas de Conta', 
        'report': 'Denúncia',
        'suggestion': 'Sugestão',
        'support': 'Suporte Geral',
        'billing': 'Financeiro',
        'feedback': 'Feedback',
        'partnership': 'Parcerias',
        'bug': 'Report de Bug',
        'appeal': 'Recurso',
        'general': 'Ajuda Geral',
        'staff': 'Candidatura Staff',
        'vip': 'Suporte VIP',
        'premium': 'Premium Support',
        'urgent': 'Urgente',
        'private': 'Privado'
    };
    return names[category] || 'Ticket Geral';
}

function getCategoryEmoji(category) {
    const emojis = {
        'technical': '🔧',
        'account': '👤',
        'report': '🚫', 
        'suggestion': '💡',
        'support': '💻',
        'billing': '💰',
        'feedback': '📝',
        'partnership': '🤝',
        'bug': '🐛',
        'appeal': '⚖️',
        'general': '❓',
        'staff': '👑',
        'vip': '👑',
        'premium': '💎',
        'urgent': '🚨',
        'private': '🔒'
    };
    return emojis[category] || '🎫';
}

function getPlaceholderText(category) {
    const placeholders = {
        'technical': 'Descreva o problema técnico que está enfrentando...',
        'account': 'Explique qual problema está tendo com sua conta...',
        'report': 'Descreva detalhadamente o que deseja reportar...',
        'suggestion': 'Compartilhe sua ideia ou sugestão de melhoria...',
        'support': 'Explique como podemos ajudá-lo...',
        'billing': 'Descreva sua questão financeira ou de pagamento...',
        'feedback': 'Compartilhe seu feedback sobre nossos serviços...',
        'partnership': 'Descreva sua proposta de parceria...'
    };
    return placeholders[category] || 'Descreva detalhadamente sua solicitação...';
}

function getPriorityColor(priority) {
    const colors = {
        'baixa': '#00D4AA',
        'média': '#FEE75C', 
        'alta': '#FF6B6B',
        'urgente': '#FF0000'
    };
    return colors[priority.toLowerCase()] || colors['média'];
}
