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
                
                // Delegar o novo sistema de tickets (prefixo 'ticket:') para o handler dedicado
                if (customId?.startsWith('ticket:')) {
                    // Delegado para events/ticketHandler.js
                    return;
                }
                
                logger.debug(`Botão pressionado - ID: "${customId}" por ${interaction.user.tag}`);
                logger.debug(`IDs disponíveis - CLOSE_TICKET: "${BUTTON_IDS.CLOSE_TICKET}", CONFIRM_CLOSE: "${BUTTON_IDS.CONFIRM_CLOSE}"`);

                // Sistema de Verificação
                if (customId === BUTTON_IDS.VERIFY_USER) {
                    try {
                        logger.interaction('button', customId, interaction, true);
                        // Per-user throttle (3s)
                        const key = `verify:${interaction.user.id}`;
                        if (!global.__verifyPressCache) global.__verifyPressCache = new Map();
                        const last = global.__verifyPressCache.get(key) || 0;
                        // Optional configurable cooldown from dashboard (overrides default)
                        let vcfg = {};
                        try { const storage = require('../utils/storage'); const cfg = await storage.getGuildConfig(interaction.guild.id); vcfg = cfg?.verification || {}; } catch {}
                        const configuredCooldownMs = Math.max(0, Number(vcfg.cooldownSeconds || 0)) * 1000;
                        const minCooldown = configuredCooldownMs || 3000;
                        if (Date.now() - last < minCooldown) {
                            return await interaction.reply({ content: `${EMOJIS.WARNING} Aguarda um momento antes de tentar novamente.`, flags: MessageFlags.Ephemeral });
                        }
                        global.__verifyPressCache.set(key, Date.now());
                        // Check verification method
                        
                        if ((vcfg.method || 'button') === 'image') {
                            // Start captcha flow (image)
                            const mode = vcfg.mode || 'easy';
                            const cm = require('../utils/captchaManager');
                            const { renderCaptchaImage } = require('../utils/captchaImage');
                            const data = cm.refresh(interaction.guild.id, interaction.user.id, mode);
                            let files = [];
                            try {
                                const img = await renderCaptchaImage(data.code);
                                if (img) files = [{ name: 'captcha.png', attachment: img }];
                            } catch {}
                            const row = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId(BUTTON_IDS.VERIFY_OPEN_CAPTCHA).setLabel('Inserir Código').setEmoji('⌨️').setStyle(ButtonStyle.Primary),
                                new ButtonBuilder().setCustomId(BUTTON_IDS.VERIFY_REFRESH_CAPTCHA).setLabel('Atualizar').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
                            );
                            const desc = files.length
                                ? `${EMOJIS.INFO} Introduz o código que vês na imagem abaixo.`
                                : `${EMOJIS.WARNING} Não foi possível gerar a imagem. Código: ${data.code}`;
                            await interaction.reply({ content: desc, files, components: [row], flags: MessageFlags.Ephemeral });
                            return;
                        }
                        if ((vcfg.method || 'button') === 'form') {
                            const questions = Array.isArray(vcfg?.form?.questions) ? vcfg.form.questions.slice(0,5) : [];
                            if (!questions.length) {
                                return await interaction.reply({ content: `${EMOJIS.ERROR} O formulário de verificação não está configurado.`, flags: MessageFlags.Ephemeral });
                            }
                            const modal = new ModalBuilder().setCustomId('modal_verification_form').setTitle('Verificação - Formulário');
                            const safe = (s) => String(s||'').slice(0,45) || 'Pergunta';
                            for (let i=0;i<questions.length;i++){
                                const q = questions[i];
                                const input = new TextInputBuilder().setCustomId(`vf_q_${i}`).setLabel(safe(q.label)).setRequired(!!q.required).setStyle((q.type==='long_text')? TextInputStyle.Paragraph : TextInputStyle.Short).setMaxLength(4000);
                                modal.addComponents(new ActionRowBuilder().addComponents(input));
                            }
                            await interaction.showModal(modal);
                            return;
                        }
                        
                        // Prefer role IDs from new verification config, fallback to legacy keys and name
                        let verifyRole = null;
                        let unverifiedRole = null;
                        try {
                            const storage = require('../utils/storage');
                            const cfg = await storage.getGuildConfig(interaction.guild.id);
                            const vcfg = cfg?.verification || {};
                            const verifiedRoleId = vcfg.verifiedRoleId || cfg?.roles?.verify || cfg?.verify_role_id || null;
                            const unverifiedRoleId = vcfg.unverifiedRoleId || null;
                            if (verifiedRoleId) verifyRole = interaction.guild.roles.cache.get(verifiedRoleId) || null;
                            if (unverifiedRoleId) unverifiedRole = interaction.guild.roles.cache.get(unverifiedRoleId) || null;
                        } catch (e) {
                            // ignore and fallback
                        }
                        if (!verifyRole) verifyRole = interaction.guild.roles.cache.find(role => role.name === 'Verificado');
                        if (!verifyRole) {
                            // Log failure for retention housekeeping
                            try {
                                const storage = require('../utils/storage');
                                await storage.addLog({
                                    guild_id: interaction.guild.id,
                                    user_id: interaction.user.id,
                                    type: 'verification_fail',
                                    message: 'role_not_found'
                                });
                            } catch {}
                            await errorHandler.handleInteractionError(interaction, new Error('VERIFY_ROLE_NOT_FOUND'));
                            return;
                        }

                        // Ensure we have a GuildMember instance (interaction.member can be null in some edge cases)
                        let member = interaction.member;
                        if (!member) {
                            try { member = await interaction.guild.members.fetch(interaction.user.id).catch(()=>null); } catch {}
                        }
                        if (member?.roles?.cache?.has(verifyRole.id)) {
                            return await interaction.reply({
                                content: `${EMOJIS.SUCCESS} Já estás verificado!`,
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        // Apply verified role and optionally remove unverified role
                        let addOk = true;
                        if (member?.roles?.add) {
                            await member.roles.add(verifyRole).catch((e) => { addOk = false; logger.debug('role add fail', e?.message); });
                        } else {
                            addOk = false;
                        }
                        if (!addOk) {
                            try {
                                const storage = require('../utils/storage');
                                await storage.addLog({
                                    guild_id: interaction.guild.id,
                                    user_id: interaction.user.id,
                                    type: 'verification_fail',
                                    message: 'role_add_failed',
                                    role_id: verifyRole.id
                                });
                            } catch {}
                            // Still respond gracefully
                        }
                        if (unverifiedRole && member?.roles?.cache?.has(unverifiedRole.id)) {
                            await member.roles.remove(unverifiedRole).catch(() => {});
                        }
                        await interaction.reply({
                            content: `${EMOJIS.SUCCESS} Verificação completa! Bem-vindo(a) ao servidor!`,
                            flags: MessageFlags.Ephemeral
                        });

                        // Log success with method for metrics
                        try {
                            const storage = require('../utils/storage');
                            await storage.addLog({ guild_id: interaction.guild.id, user_id: interaction.user.id, type: 'verification_success', message: (vcfg.method || 'button') });
                        } catch {}

                        // Structured diagnostic log
                        logger.database('verification', {
                            userId: interaction.user.id,
                            guildId: interaction.guild.id,
                            roleId: verifyRole.id,
                            action: 'user_verified'
                        });

                        // Optional retention pruning for failure logs based on dashboard config
                        try {
                            const storage = require('../utils/storage');
                            const cfg = await storage.getGuildConfig(interaction.guild.id);
                            const keepDays = Number(cfg?.verification?.logFailRetention);
                            const logFails = Boolean(cfg?.verification?.logFails);
                            if (logFails && keepDays && keepDays > 0) {
                                await storage.pruneLogsByTypeOlderThan(interaction.guild.id, 'verification_fail', keepDays * 24 * 60 * 60 * 1000);
                            }
                        } catch {}

                        // Analytics para dashboard
                        if (global.socketManager) {
                            global.socketManager.broadcast('verification', {
                                userId: interaction.user.id,
                                username: interaction.user.username,
                                method: vcfg.method || 'button',
                                timestamp: new Date().toISOString()
                            });
                        }

                    } catch (error) {
                        await errorHandler.handleInteractionError(interaction, error);
                    }
                    return;
                }

                // Verification captcha buttons
                if (customId === BUTTON_IDS.VERIFY_OPEN_CAPTCHA) {
                    try {
                        const modal = new ModalBuilder().setCustomId(MODAL_IDS.VERIFICATION_CAPTCHA).setTitle('Verificação Captcha');
                        const input = new TextInputBuilder().setCustomId(INPUT_IDS.CAPTCHA_INPUT).setLabel('Código da imagem').setMaxLength(16).setRequired(true).setStyle(TextInputStyle.Short);
                        modal.addComponents(new ActionRowBuilder().addComponents(input));
                        await interaction.showModal(modal);
                    } catch (error) { await errorHandler.handleInteractionError(interaction, error); }
                    return;
                }
                if (customId === BUTTON_IDS.VERIFY_REFRESH_CAPTCHA) {
                    try {
                        let vcfg = {};
                        try { const storage = require('../utils/storage'); const cfg = await storage.getGuildConfig(interaction.guild.id); vcfg = cfg?.verification || {}; } catch {}
                        const mode = vcfg.mode || 'easy';
                        const cm = require('../utils/captchaManager');
                        const { renderCaptchaImage } = require('../utils/captchaImage');
                        const data = cm.refresh(interaction.guild.id, interaction.user.id, mode);
                        let files = [];
                        try { const img = await renderCaptchaImage(data.code); if (img) files = [{ name: 'captcha.png', attachment: img }]; } catch {}
                        const desc = files.length
                            ? `${EMOJIS.INFO} Novo captcha gerado. Introduz o código da imagem abaixo.`
                            : `${EMOJIS.WARNING} Não foi possível gerar a imagem. Código: ${data.code}`;
                        await interaction.reply({ content: desc, files, flags: MessageFlags.Ephemeral });
                    } catch (error) { await errorHandler.handleInteractionError(interaction, error); }
                    return;
                }

                // Botões do Painel de Tickets (tipos específicos)
                if (customId.startsWith('ticket_create_')) {
                    // Fluxo legado desativado – usar botões 'ticket:create:*' do novo sistema
                    return;
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
                        // Construir transcript simples (últimas 200 mensagens)
                        let transcriptText = '';
                        try {
                            const fetched = await interaction.channel.messages.fetch({ limit: 200 }).catch(() => null);
                            const messages = fetched ? Array.from(fetched.values()).sort((a,b)=>a.createdTimestamp-b.createdTimestamp) : [];
                            transcriptText = `TRANSCRICAO TICKET ${interaction.channel.name} (ID canal ${interaction.channel.id})\nServidor: ${interaction.guild?.name} (${interaction.guildId})\nFechado por: ${interaction.user.tag} em ${new Date().toISOString()}\n\n`;
                            for (const msg of messages) {
                                const ts = new Date(msg.createdTimestamp).toISOString();
                                const author = msg.author?.tag || msg.author?.id || 'Desconhecido';
                                const content = msg.content?.replace(/\n/g,' ') || '';
                                transcriptText += `${ts} - ${author}: ${content}\n`;
                            }
                        } catch(_) {}
                        await interaction.channel.send({ embeds: [closedEmbed] });
                        // Persistir status e enviar logs simplificados (compatibilidade)
                        try {
                            const storage = require('../utils/storage');
                            // Buscar ticket pelo channel_id
                            const ticketRecord = await storage.getTicketByChannel(interaction.channel.id);
                            if (ticketRecord) {
                                await storage.updateTicket(ticketRecord.id, { status: 'closed', closed_by: interaction.user.id, closed_at: new Date().toISOString(), archived: 1 });
                                // Opcional: enviar transcript para canal de logs se configurado
                                try {
                                    const cfg = await storage.getGuildConfig(interaction.guild.id);
                                    const logChannelId = cfg?.channels?.logs || null;
                                    if (logChannelId) {
                                        const logCh = interaction.guild.channels.cache.get(logChannelId) || await client.channels.fetch(logChannelId).catch(()=>null);
                                        if (logCh && logCh.send) {
                                            await logCh.send({ content: `📄 Transcript do ticket #${ticketRecord.id} (${interaction.channel.name}) fechado por ${interaction.user.tag}` });
                                            if (transcriptText) {
                                                const { AttachmentBuilder } = require('discord.js');
                                                const attach = new AttachmentBuilder(Buffer.from(transcriptText,'utf8'), { name: `transcript-ticket-${ticketRecord.id}.txt` });
                                                await logCh.send({ files: [attach] }).catch(()=>null);
                                            }
                                        }
                                    }
                                } catch (logSendErr) {
                                    logger.warn('Falha ao enviar transcript para canal de logs', { error: logSendErr?.message || logSendErr });
                                }

                                // 🔥 ENVIAR LOG SIMPLIFICADO PARA WEBHOOK
                                try {
                                    const ticketManager = interaction.client.ticketManager;
                                    if (ticketManager) {
                                        // Coletar mensagens para transcript
                                        let transcriptText = '';
                                        try {
                                            const fetched = await interaction.channel.messages.fetch({ limit: 100 }).catch(() => null);
                                            const messages = fetched ? Array.from(fetched.values()).sort((a,b)=>a.createdTimestamp-b.createdTimestamp) : [];
                                            
                                            // Gerar transcript textual
                                            transcriptText = `TRANSCRIÇÃO DO TICKET #${ticketRecord.id}
========================================
Data de criação: ${new Date(ticketRecord.created_at || Date.now()).toLocaleString('pt-PT')}
Usuário: ${ticketRecord.user_id}
Canal: #${interaction.channel.name}
Servidor: ${interaction.guild.name}
========================================

`;
                                            
                                            if (messages && messages.length > 0) {
                                                messages.forEach(msg => {
                                                    const timestamp = new Date(msg.createdTimestamp).toLocaleTimeString('pt-PT');
                                                    transcriptText += `[${timestamp}] ${msg.author?.tag || 'Usuário'}: ${msg.content}\n`;
                                                });
                                            } else {
                                                transcriptText += '(Nenhuma mensagem registrada)\n';
                                            }
                                            
                                            transcriptText += `\n========================================
Ticket fechado por: ${interaction.user.tag}
Data de fechamento: ${new Date().toLocaleString('pt-PT')}
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

                                    // Integração antiga com DB/webhooks removida no novo sistema baseado em storage.
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
                        // Permission check: ManageChannels or Moderator-like
                        const can = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
                        if (!can) return await interaction.reply({ content: `${EMOJIS.ERROR} Precisas da permissão Gerir Canais para usar esta ação.`, flags: MessageFlags.Ephemeral });
                        await interaction.reply({ content: 'Indica o ID ou menção do membro que queres chamar (responde neste chat):', flags: MessageFlags.Ephemeral });
                    } catch (err) {
                        logger.warn('Erro ao pedir ID para chamar membro', { error: err && err.message ? err.message : err });
                    }
                    return;
                }

                // Adicionar membro ao ticket (abre modal para inserir ID)
                if (customId === BUTTON_IDS.TICKET_ADD_MEMBER) {
                    try {
                        const can = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
                        if (!can) return await interaction.reply({ content: `${EMOJIS.ERROR} Precisas da permissão Gerir Canais para adicionar membros.`, flags: MessageFlags.Ephemeral });
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
                        const can = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
                        if (!can) return await interaction.reply({ content: `${EMOJIS.ERROR} Precisas da permissão Gerir Canais para remover membros.`, flags: MessageFlags.Ephemeral });
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
                        const can = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
                        if (!can) return await interaction.reply({ content: `${EMOJIS.ERROR} Precisas da permissão Gerir Canais para mover tickets.`, flags: MessageFlags.Ephemeral });
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
                        const can = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
                        if (!can) return await interaction.reply({ content: `${EMOJIS.ERROR} Precisas da permissão Gerir Canais para renomear tickets.`, flags: MessageFlags.Ephemeral });
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
                        const can = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
                        if (!can) return await interaction.reply({ content: `${EMOJIS.ERROR} Precisas da permissão Gerir Canais para finalizar tickets.`, flags: MessageFlags.Ephemeral });
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
                const customId = interaction.customId;
                if (customId === 'modal_verification_form') {
                    try {
                        const storage = require('../utils/storage');
                        const cfg = await storage.getGuildConfig(interaction.guild.id);
                        const vcfg = cfg?.verification || {};
                        const questions = Array.isArray(vcfg?.form?.questions) ? vcfg.form.questions.slice(0,5) : [];
                        const answers = [];
                        for (let i=0;i<questions.length;i++){
                            const q = questions[i];
                            const val = interaction.fields.getTextInputValue(`vf_q_${i}`) || '';
                            if (q.required && !String(val).trim()) {
                                return await interaction.reply({ content: `${EMOJIS.ERROR} Responde a todas as perguntas obrigatórias.`, flags: MessageFlags.Ephemeral });
                            }
                            answers.push({ id: q.id, label: q.label, value: val });
                        }
                        // Grant roles
                        let verifyRole = null; let unverifiedRole = null;
                        const verifiedRoleId = vcfg.verifiedRoleId || cfg?.roles?.verify || cfg?.verify_role_id || null;
                        const unverifiedRoleId = vcfg.unverifiedRoleId || null;
                        if (verifiedRoleId) verifyRole = interaction.guild.roles.cache.get(verifiedRoleId) || null;
                        if (unverifiedRoleId) unverifiedRole = interaction.guild.roles.cache.get(unverifiedRoleId) || null;
                        if (!verifyRole) return await interaction.reply({ content: `${EMOJIS.ERROR} Cargo de verificado não encontrado.`, flags: MessageFlags.Ephemeral });
                        if (interaction.member.roles.cache.has(verifyRole.id)) return await interaction.reply({ content: `${EMOJIS.SUCCESS} Já estás verificado!`, flags: MessageFlags.Ephemeral });
                        await interaction.member.roles.add(verifyRole).catch(()=>{});
                        if (unverifiedRole && interaction.member.roles.cache.has(unverifiedRole.id)) await interaction.member.roles.remove(unverifiedRole).catch(()=>{});
                        // store a lightweight log entry
                        try { await storage.addLog({ guild_id: interaction.guild.id, user_id: interaction.user.id, type: 'verification_form', data: { answersCount: answers.length } }); } catch {}
                        // metrics success
                        try { await storage.addLog({ guild_id: interaction.guild.id, user_id: interaction.user.id, type: 'verification_success', message: 'form' }); } catch {}
                        await interaction.reply({ content: `${EMOJIS.SUCCESS} Verificação completa! Bem-vindo(a) ao servidor!`, flags: MessageFlags.Ephemeral });
                    } catch (error) { await errorHandler.handleInteractionError(interaction, error); }
                    return;
                }
                if (customId === MODAL_IDS.VERIFICATION_CAPTCHA) {
                    try {
                        const input = interaction.fields.getTextInputValue(INPUT_IDS.CAPTCHA_INPUT).trim();
                        const cm = require('../utils/captchaManager');
                        const res = cm.validate(interaction.guild.id, interaction.user.id, input);
                        if (!res.ok) {
                            const reason = res.reason === 'expired' ? 'Captcha expirado. Carrega em Atualizar e tenta novamente.' : 'Código incorreto. Tenta outra vez.';
                            // Log fail
                            try {
                                const storage = require('../utils/storage');
                                await storage.addLog({ guild_id: interaction.guild.id, user_id: interaction.user.id, type: 'verification_fail', message: `captcha_${res.reason||'mismatch'}` });
                            } catch {}
                            return await interaction.reply({ content: `${EMOJIS.ERROR} ${reason}`, flags: MessageFlags.Ephemeral });
                        }

                        // On success, grant role (reuse existing logic)
                        let verifyRole = null; let unverifiedRole = null;
                        try {
                            const storage = require('../utils/storage');
                            const cfg = await storage.getGuildConfig(interaction.guild.id);
                            const vcfg = cfg?.verification || {};
                            const verifiedRoleId = vcfg.verifiedRoleId || cfg?.roles?.verify || cfg?.verify_role_id || null;
                            const unverifiedRoleId = vcfg.unverifiedRoleId || null;
                            if (verifiedRoleId) verifyRole = interaction.guild.roles.cache.get(verifiedRoleId) || null;
                            if (unverifiedRoleId) unverifiedRole = interaction.guild.roles.cache.get(unverifiedRoleId) || null;
                        } catch {}
                        if (!verifyRole) return await interaction.reply({ content: `${EMOJIS.ERROR} Cargo de verificado não encontrado.`, flags: MessageFlags.Ephemeral });
                        if (interaction.member.roles.cache.has(verifyRole.id)) return await interaction.reply({ content: `${EMOJIS.SUCCESS} Já estás verificado!`, flags: MessageFlags.Ephemeral });
                        await interaction.member.roles.add(verifyRole).catch(()=>{});
                        if (unverifiedRole && interaction.member.roles.cache.has(unverifiedRole.id)) {
                            await interaction.member.roles.remove(unverifiedRole).catch(()=>{});
                        }
                        await interaction.reply({ content: `${EMOJIS.SUCCESS} Verificação completa! Bem-vindo(a) ao servidor!`, flags: MessageFlags.Ephemeral });
                        // metrics success
                        try { const storage = require('../utils/storage'); await storage.addLog({ guild_id: interaction.guild.id, user_id: interaction.user.id, type: 'verification_success', message: 'image' }); } catch {}
                    } catch (error) { await errorHandler.handleInteractionError(interaction, error); }
                    return;
                }
                // Desativar fluxos legados de tickets baseados em modais
                const legacyModals = new Set(['modal_add_member','modal_remove_member','modal_move_ticket','modal_rename_channel','modal_internal_note']);
                if (customId.startsWith('ticket_modal_') || legacyModals.has(customId)) {
                    return;
                }
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

                // Sistema legado de modals desativado — não carregar handlers antigos

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

                        // Sem DB: apenas postar a observação como mensagem marcada
                        await interaction.channel.send({ content: `📝 Nota interna de ${interaction.user}: ${note}` });
                        await interaction.reply({ content: `${EMOJIS.SUCCESS} Observação interna adicionada (visível no canal).`, flags: MessageFlags.Ephemeral });
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
                    // Fluxo de seleção de categoria legado desativado no novo sistema
                    return;
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
                    // Fluxo de modais legado desativado no novo sistema
                    return;
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
                        // Importar o novo sistema de painel
                        const TicketPanelManager = require('../utils/TicketPanelManager');
                        const panelManager = new TicketPanelManager(client);

                        // Criar dados do ticket para o painel
                        const ticketData = {
                            ticketId: ticketChannel.id,
                            ownerId: interaction.user.id,
                            category: categoryType,
                            priority: priority,
                            createdAt: new Date().toISOString(),
                            status: 'open',
                            description: description,
                            subject: subject
                        };

                        // Criar e enviar o novo painel
                        const panelData = await panelManager.createCompletePanel(
                            ticketData, 
                            interaction.guild, 
                            interaction.user, 
                            null // Nenhum staff atribuído inicialmente
                        );

                        await ticketChannel.send({
                            content: `${interaction.user} **Ticket criado com sucesso!** 🎉\n\n🛎️ **Nossa equipe foi notificada e responderá em breve.**`,
                            ...panelData
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

// Nota: Funções auxiliares do painel antigo removidas
// O novo sistema de painel será implementado com as especificações fornecidas
