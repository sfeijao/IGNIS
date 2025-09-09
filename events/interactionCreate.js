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
                        
                        // Defer a resposta para dar mais tempo (15 minutos)
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                        
                        const ticketCategory = await getOrCreateTicketCategory(interaction.guild);

                        // Delegar para o sistema de tickets
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
                            await interaction.editReply({
                                content: `${EMOJIS.ERROR} Ocorreu um erro ao criar o ticket. Por favor, tente novamente.`
                            });
                        }

                        // Obter informações do tipo de ticket
                        const typeInfo = getTicketTypeInfo(ticketType);

                        // Embed do ticket
                        const ticketEmbed = new EmbedBuilder()
                            .setTitle(`${typeInfo.emoji} Ticket Criado - ${typeInfo.title}`)
                            .setDescription(`Olá ${interaction.user}, o teu ticket foi criado com sucesso!\n\nDescreve o teu problema ou questão em detalhe e a nossa equipa irá ajudar-te rapidamente.`)
                            .addFields(
                                { name: '👤 Utilizador', value: `${interaction.user}`, inline: true },
                                { name: '📂 Categoria', value: typeInfo.title, inline: true },
                                { name: '🕐 Criado', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                                { name: '📋 Status', value: '🟢 Aberto', inline: true }
                            )
                            .setColor(typeInfo.color)
                            .setTimestamp();

                        // Build full ticket panel with multiple rows of buttons
                        const row1 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(BUTTON_IDS.TICKET_CALL_MEMBER).setLabel('🔔 Chamar Membro').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId(BUTTON_IDS.TICKET_ADD_MEMBER).setLabel('➕ Adicionar Membro').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId(BUTTON_IDS.TICKET_REMOVE_MEMBER).setLabel('❌ Remover Membro').setStyle(ButtonStyle.Danger)
                        );

                        const row2 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(BUTTON_IDS.TICKET_MOVE).setLabel('🔀 Mover Ticket').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId(BUTTON_IDS.TICKET_RENAME_CHANNEL).setLabel('📝 Trocar Nome do Canal').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId(BUTTON_IDS.TICKET_GREET).setLabel('👋 Saudar Atendimento').setStyle(ButtonStyle.Primary)
                        );

                        const row3 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(BUTTON_IDS.TICKET_INTERNAL_NOTE).setLabel('📝 Observação Interna').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId(BUTTON_IDS.TICKET_FINALIZE).setLabel('✅ Finalizar Ticket').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId(BUTTON_IDS.CLOSE_TICKET).setLabel('🔒 Fechar Ticket').setStyle(ButtonStyle.Danger)
                        );

                        // Prefer configured staff role ID for mention, fallback to role name or permission check
                        let staffRoleId = null;
                        try {
                            const db = new Database();
                            await db.initialize();
                            const cfg = await db.getGuildConfig(interaction.guild.id, 'staff_role_id');
                            if (cfg?.value) staffRoleId = cfg.value;
                        } catch (e) {
                            // ignore
                        }
                        if (!staffRoleId) staffRoleId = interaction.guild.roles.cache.find(r => r.name === 'Staff')?.id || interaction.guild.roles.cache.find(r => r.permissions.has('MANAGE_MESSAGES'))?.id;

                        await ticketChannel.send({
                            content: `${interaction.user} ${staffRoleId ? `| <@&${staffRoleId}>` : ''}`,
                            embeds: [ticketEmbed],
                            components: [row1, row2, row3]
                        });

                        await interaction.editReply({
                            content: `${EMOJIS.SUCCESS} Ticket criado: ${ticketChannel}`
                        });

                        // Salvar ticket na base de dados
                        let result = null;
                        try {
                            const db = new Database();
                            await db.initialize();
                            
                            // Primeiro, criar/atualizar o utilizador
                            const userData = {
                                discord_id: interaction.user.id,
                                username: interaction.user.username,
                                discriminator: interaction.user.discriminator || '0',
                                avatar: interaction.user.avatar,
                                email: null,
                                global_name: interaction.user.globalName || interaction.user.username
                            };
                            
                            await db.createUser(userData);
                            logger.info(`Utilizador ${interaction.user.username} atualizado na base de dados`, { userId: interaction.user.id });
                            
                            // Depois, criar o ticket
                            const ticketData = {
                                guild_id: interaction.guild.id,
                                channel_id: ticketChannel.id,
                                user_id: interaction.user.id,
                                category: ticketType,
                                title: `${typeInfo.title} - ${interaction.user.username}`,
                                subject: typeInfo.title,
                                description: `Ticket criado via painel de ${typeInfo.title.toLowerCase()}`,
                                severity: 'medium'
                            };
                            
                            result = await db.createTicket(ticketData);
                            logger.info(`Ticket salvo na base de dados com ID: ${result.id}`, { ticketId: result.id });
                            
                        } catch (dbError) {
                            logger.error('Erro ao salvar ticket na base de dados:', { error: dbError.message || dbError });
                        }

                        // Log estruturado do ticket
                        logger.database('ticket_created', {
                            userId: interaction.user.id,
                            channelId: ticketChannel.id,
                            guildId: interaction.guild.id,
                            ticketName: ticketChannel.name,
                            ticketType: ticketType
                        });

                        // Enviar via webhook para outro Discord
                        await sendTicketWebhook({
                            userName: interaction.user.tag,
                            userId: interaction.user.id,
                            channelId: ticketChannel.id,
                            channelName: ticketChannel.name,
                            ticketType: ticketType,
                            guildName: interaction.guild.name,
                            guildId: interaction.guild.id
                        });

                        // Analytics para dashboard
                        if (global.socketManager) {
                            global.socketManager.broadcast('ticket_created', {
                                id: result?.id,
                                guildId: interaction.guild.id,
                                channelId: ticketChannel.id,
                                userId: interaction.user.id,
                                username: interaction.user.username,
                                discriminator: interaction.user.discriminator || '0',
                                avatar: interaction.user.avatar,
                                globalName: interaction.user.globalName,
                                category: ticketType,
                                title: `${typeInfo.title} - ${interaction.user.username}`,
                                subject: typeInfo.title,
                                status: 'open',
                                severity: 'medium',
                                channelName: ticketChannel.name,
                                timestamp: new Date().toISOString(),
                                createdAt: new Date().toISOString()
                            });
                            
                            logger.info('Socket.IO: Ticket enviado para dashboard em tempo real', { ticketId: result?.id });
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
            }

        } catch (error) {
            await errorHandler.handleInteractionError(interaction, error);
        }
    }
};
