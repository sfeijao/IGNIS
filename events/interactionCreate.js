const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const Database = require('../website/database/database');
const errorHandler = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { BUTTON_IDS, MODAL_IDS, INPUT_IDS, EMBED_COLORS, EMOJIS, ERROR_MESSAGES } = require('../constants/ui');

// Função auxiliar para obter ou criar categoria de tickets
async function getOrCreateTicketCategory(guild) {
    let ticketCategory = guild.channels.cache.find(c => c.name === '📁 TICKETS' && c.type === ChannelType.GuildCategory);
    
    if (!ticketCategory) {
        console.log(`🎫 DEBUG: Categoria '📁 TICKETS' não encontrada, criando automaticamente...`);
        try {
            ticketCategory = await guild.channels.create({
                name: '📁 TICKETS',
                type: ChannelType.GuildCategory,
                reason: 'Categoria criada automaticamente para sistema de tickets'
            });
            console.log(`🎫 DEBUG: Categoria criada com sucesso: ${ticketCategory.name}`);
        } catch (error) {
            console.error(`🎫 ERROR: Erro ao criar categoria:`, error);
            throw new Error('FAILED_TO_CREATE_TICKET_CATEGORY');
        }
    }
    
    return ticketCategory;
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        console.log(`🔧 DEBUG: interactionCreate chamado - client exists: ${!!client}, commands exists: ${!!client?.commands}`);
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
                        ephemeral: true
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
                console.log(`🔘 DEBUG: Botão pressionado - ID: "${customId}" por ${interaction.user.tag}`);
                console.log(`🔘 DEBUG: IDs disponíveis - CLOSE_TICKET: "${BUTTON_IDS.CLOSE_TICKET}", CONFIRM_CLOSE: "${BUTTON_IDS.CONFIRM_CLOSE}"`);

                // Sistema de Verificação
                if (customId === BUTTON_IDS.VERIFY_USER) {
                    try {
                        logger.interaction('button', customId, interaction, true);
                        
                        const verifyRole = interaction.guild.roles.cache.find(role => role.name === 'Verificado');
                        if (!verifyRole) {
                            await errorHandler.handleInteractionError(interaction, new Error('VERIFY_ROLE_NOT_FOUND'));
                            return;
                        }

                        if (interaction.member.roles.cache.has(verifyRole.id)) {
                            return await interaction.reply({
                                content: `${EMOJIS.SUCCESS} Já estás verificado!`,
                                ephemeral: true
                            });
                        }

                        await interaction.member.roles.add(verifyRole);
                        await interaction.reply({
                            content: `${EMOJIS.SUCCESS} Verificação completa! Bem-vindo(a) ao servidor!`,
                            ephemeral: true
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

                // Sistema de Tickets
                if (customId === BUTTON_IDS.CREATE_TICKET) {
                    try {
                        logger.interaction('button', customId, interaction, true);
                        
                        const ticketCategory = await getOrCreateTicketCategory(interaction.guild);

                        // Verificar se já tem ticket aberto
                        const existingTicket = interaction.guild.channels.cache.find(
                            c => c.name === `ticket-${interaction.user.username.toLowerCase()}` && c.parentId === ticketCategory.id
                        );

                        if (existingTicket) {
                            return await interaction.reply({
                                content: `${EMOJIS.ERROR} Já tens um ticket aberto: ${existingTicket}`,
                                ephemeral: true
                            });
                        }

                        // Criar canal de ticket
                        const ticketChannel = await interaction.guild.channels.create({
                            name: `ticket-${interaction.user.username.toLowerCase()}`,
                            type: ChannelType.GuildText,
                            parent: ticketCategory.id,
                            permissionOverwrites: [
                                {
                                    id: interaction.guild.id,
                                    deny: [PermissionFlagsBits.ViewChannel],
                                },
                                {
                                    id: interaction.user.id,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                                },
                            ],
                        });

                        // Embed do ticket
                        const ticketEmbed = new EmbedBuilder()
                            .setTitle('🎫 Ticket Criado')
                            .setDescription(`Olá ${interaction.user}, o teu ticket foi criado com sucesso!`)
                            .addFields(
                                { name: '👤 Utilizador', value: `${interaction.user}`, inline: true },
                                { name: '🕐 Criado', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                                { name: '📋 Status', value: '🟢 Aberto', inline: true }
                            )
                            .setColor(EMBED_COLORS.SUCCESS)
                            .setTimestamp();

                        const closeButton = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(BUTTON_IDS.CLOSE_TICKET)
                                    .setLabel(`${EMOJIS.TICKET} Fechar Ticket`)
                                    .setStyle(ButtonStyle.Danger)
                            );

                        await ticketChannel.send({
                            content: `${interaction.user}`,
                            embeds: [ticketEmbed],
                            components: [closeButton]
                        });

                        await interaction.reply({
                            content: `${EMOJIS.SUCCESS} Ticket criado: ${ticketChannel}`,
                            ephemeral: true
                        });

                        // Log estruturado do ticket
                        logger.database('ticket_created', {
                            userId: interaction.user.id,
                            channelId: ticketChannel.id,
                            guildId: interaction.guild.id,
                            ticketName: ticketChannel.name
                        });

                        // Analytics para dashboard
                        if (global.socketManager) {
                            global.socketManager.broadcast('ticket_created', {
                                userId: interaction.user.id,
                                username: interaction.user.username,
                                channelId: ticketChannel.id,
                                timestamp: new Date().toISOString()
                            });
                        }

                    } catch (error) {
                        await errorHandler.handleInteractionError(interaction, error);
                    }
                    return;
                }

                // Botões do Painel de Tickets
                if (customId.startsWith('ticket_create_')) {
                    try {
                        const ticketType = customId.replace('ticket_create_', '');
                        console.log(`🎫 DEBUG: Criando ticket tipo: "${ticketType}" para ${interaction.user.tag}`);
                        logger.interaction('button', customId, interaction, true);
                        
                        const ticketCategory = await getOrCreateTicketCategory(interaction.guild);

                        // Verificar se já tem ticket aberto
                        const existingTicket = interaction.guild.channels.cache.find(
                            c => c.name === `ticket-${interaction.user.username.toLowerCase()}` && c.parentId === ticketCategory.id
                        );

                        if (existingTicket) {
                            return await interaction.reply({
                                content: `${EMOJIS.ERROR} Já tens um ticket aberto: ${existingTicket}`,
                                ephemeral: true
                            });
                        }

                        // Criar canal do ticket
                        const ticketChannel = await interaction.guild.channels.create({
                            name: `ticket-${interaction.user.username.toLowerCase()}`,
                            type: ChannelType.GuildText,
                            parent: ticketCategory.id,
                            permissionOverwrites: [
                                {
                                    id: interaction.guild.id,
                                    deny: [PermissionFlagsBits.ViewChannel],
                                },
                                {
                                    id: interaction.user.id,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                                },
                            ],
                        });

                        // Map de tipos de ticket para emojis e cores
                        const ticketTypeInfo = {
                            'suporte': { emoji: '🛠️', color: EMBED_COLORS.PRIMARY, title: 'Suporte Técnico' },
                            'problema': { emoji: '🚨', color: EMBED_COLORS.ERROR, title: 'Reportar Problema' },
                            'sugestao': { emoji: '💡', color: EMBED_COLORS.SUCCESS, title: 'Sugestão' },
                            'moderacao': { emoji: '👤', color: EMBED_COLORS.WARNING, title: 'Questão de Moderação' },
                            'geral': { emoji: '📝', color: EMBED_COLORS.INFO, title: 'Geral' }
                        };

                        const typeInfo = ticketTypeInfo[ticketType] || ticketTypeInfo['geral'];

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

                        const closeButton = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(BUTTON_IDS.CLOSE_TICKET)
                                    .setLabel(`${EMOJIS.TICKET} Fechar Ticket`)
                                    .setStyle(ButtonStyle.Danger)
                            );

                        await ticketChannel.send({
                            content: `${interaction.user} | <@&${interaction.guild.roles.cache.find(r => r.name === 'Staff')?.id || interaction.guild.roles.cache.find(r => r.permissions.has('MANAGE_MESSAGES'))?.id}>`,
                            embeds: [ticketEmbed],
                            components: [closeButton]
                        });

                        await interaction.reply({
                            content: `${EMOJIS.SUCCESS} Ticket criado: ${ticketChannel}`,
                            ephemeral: true
                        });

                        // Log estruturado do ticket
                        logger.database('ticket_created', {
                            userId: interaction.user.id,
                            channelId: ticketChannel.id,
                            guildId: interaction.guild.id,
                            ticketName: ticketChannel.name,
                            ticketType: ticketType
                        });

                        // Analytics para dashboard
                        if (global.socketManager) {
                            global.socketManager.broadcast('ticket_created', {
                                userId: interaction.user.id,
                                username: interaction.user.username,
                                channelId: ticketChannel.id,
                                ticketType: ticketType,
                                timestamp: new Date().toISOString()
                            });
                        }

                    } catch (error) {
                        await errorHandler.handleInteractionError(interaction, error);
                    }
                    return;
                }

                // Fechar Ticket
                if (customId === BUTTON_IDS.CLOSE_TICKET) {
                    try {
                        console.log(`🎫 DEBUG: Botão fechar ticket clicado por ${interaction.user.tag}`);
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

                        console.log(`🎫 DEBUG: Embed de confirmação criado`);
                        await interaction.reply({
                            embeds: [confirmEmbed],
                            components: [confirmButtons],
                            ephemeral: true
                        });

                    } catch (error) {
                        await errorHandler.handleInteractionError(interaction, error);
                    }
                    return;
                }

                // Confirmar fecho do ticket
                if (customId === BUTTON_IDS.CONFIRM_CLOSE) {
                    try {
                        console.log(`🎫 DEBUG: Confirmação de fecho de ticket por ${interaction.user.tag}`);
                        logger.interaction('button', customId, interaction, true);
                        
                        const closedEmbed = new EmbedBuilder()
                            .setTitle('🔒 Ticket Fechado')
                            .setDescription(`Ticket fechado por ${interaction.user}`)
                            .addFields(
                                { name: '🕐 Fechado em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                            )
                            .setColor(EMBED_COLORS.ERROR)
                            .setTimestamp();

                        console.log(`🎫 DEBUG: Enviando embed de fechamento`);
                        await interaction.channel.send({ embeds: [closedEmbed] });
                        
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

                        console.log(`🎫 DEBUG: Respondendo com confirmação de fechamento`);
                        await interaction.reply({
                            content: `${EMOJIS.SUCCESS} Ticket será fechado em 5 segundos...`,
                            ephemeral: true
                        });

                        console.log(`🎫 DEBUG: Iniciando timeout para deletar canal em 5 segundos`);
                        setTimeout(async () => {
                            try {
                                console.log(`🎫 DEBUG: Tentando deletar canal ${interaction.channel.id}`);
                                await interaction.channel.delete();
                                console.log(`🎫 DEBUG: Canal deletado com sucesso`);
                            } catch (error) {
                                console.error(`🎫 ERROR: Erro ao deletar canal:`, error);
                                logger.error('Erro ao deletar canal de ticket', { 
                                    channelId: interaction.channel.id,
                                    error: error.message 
                                });
                            }
                        }, 5000);

                    } catch (error) {
                        console.error(`🎫 ERROR: Erro no processo de fechar ticket:`, error);
                        await errorHandler.handleInteractionError(interaction, error);
                    }
                    return;
                }

                // Cancelar fecho
                if (customId === BUTTON_IDS.CANCEL_CLOSE) {
                    console.log(`🎫 DEBUG: Cancelar fecho de ticket por ${interaction.user.tag}`);
                    await interaction.reply({
                        content: `${EMOJIS.SUCCESS} Fecho cancelado.`,
                        ephemeral: true
                    });
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
                            ephemeral: true
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
            }

        } catch (error) {
            await errorHandler.handleInteractionError(interaction, error);
        }
    }
};
